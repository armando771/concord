package music

import (
	"context"
	"errors"
	"io"
	"log"
	"os"
	"sync"
	"time"
)

const (
	downloadTimeout = 120 * time.Second
	maxVideoMs      = 3 * 60 * 60 * 1000
)

type Notifier interface {
	PublishState(p *Player)
	Public(textChannelID, content string)
	Humans(callID string) []string
	Closed(p *Player)
	// Played: a música de userID tocou o bastante (badge DJ, played.go).
	Played(callID, userID string)
}

type PlayerDeps struct {
	Source      Source
	Prepare     func(ctx context.Context, path string) (io.ReadCloser, error)
	NewOutput   func(ctx context.Context, callID, channelID string, src FrameSource) (Output, error)
	Notify      Notifier
	Now         func() time.Time
	CacheDir    string
	QueueMax    int
	IdleTimeout time.Duration
	Crossfade   time.Duration
	SkipFade    time.Duration
	// PlayedAfter: quanto a música toca até contar no DJ (0 = playedAfter).
	PlayedAfter time.Duration
}

type EnqueueResult struct {
	Added      int
	FirstPos   int
	StartsNow  bool
	StartsInMs int64
	AddedMs    int64
}

type SkipKind int

const (
	SkipNothing SkipKind = iota + 1
	SkipDone
	SkipVoted
	SkipAlready
)

type SkipResult struct {
	Kind   SkipKind
	Votes  int
	Needed int
}

type Snapshot struct {
	Now       *Item
	StartedAt time.Time
	Queue     []*Item
	Voters    []string
	Needed    int
}

// Player toca a fila de um canal de voz: um participante LiveKit próprio.
type Player struct {
	CallID      string
	ChannelID   string
	ServerID    string
	ChannelName string

	deps   PlayerDeps
	events chan MixEvent

	mu         sync.Mutex
	ctx        context.Context
	cancel     context.CancelFunc
	queue      *Queue
	now        *Item
	nowStarted time.Time
	fading     map[string]*Item // tocando o fim, saindo no crossfade
	votes      *Votes
	mixer      *Mixer
	out        Output
	preparing  map[string]context.CancelFunc
	nextTag    string // item da fila já carregado no mixer como próxima
	skipped    string // item atual que já teve skip emitido (ignora skips repetidos)
	idle       *time.Timer
	watchers   map[string]struct{}
	videoJobs  map[string]bool
	lastText   string // canal de texto do último pedido (aviso de queda)
	closed     bool
}

func NewPlayer(callID, channelID, serverID, channelName string, deps PlayerDeps) *Player {
	return &Player{
		CallID: callID, ChannelID: channelID, ServerID: serverID, ChannelName: channelName,
		deps:      deps,
		events:    make(chan MixEvent, 64),
		queue:     NewQueue(deps.QueueMax),
		fading:    map[string]*Item{},
		votes:     NewVotes(),
		preparing: map[string]context.CancelFunc{},
		watchers:  map[string]struct{}{},
		videoJobs: map[string]bool{},
	}
}

func (p *Player) Start(ctx context.Context) error {
	if err := os.MkdirAll(p.deps.CacheDir, 0o755); err != nil {
		return err
	}
	p.ctx, p.cancel = context.WithCancel(ctx)
	p.mixer = NewMixer(p.deps.Crossfade, p.deps.SkipFade, func(e MixEvent) {
		// Nunca trava o mixer depois do encerramento.
		select {
		case p.events <- e:
		case <-p.ctx.Done():
		}
	})
	out, err := p.deps.NewOutput(p.ctx, p.CallID, p.ChannelID, p.mixer)
	if err != nil {
		p.cancel()
		return err
	}
	p.out = out
	go p.eventLoop()
	go func() {
		select {
		case <-out.Done():
			p.shutdown(true)
		case <-p.ctx.Done():
		}
	}()
	return nil
}

func (p *Player) eventLoop() {
	for {
		select {
		case <-p.ctx.Done():
			return
		case e := <-p.events:
			p.handleEvent(e)
		}
	}
}

func (p *Player) handleEvent(e MixEvent) {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return
	}
	switch e.Kind {
	case EventStarted:
		it := p.queue.Take(e.Tag)
		if it == nil {
			// Foi removida enquanto estava no mixer: corta, sem mexer na atual.
			log.Printf("[music] faixa %s começou mas não está mais na fila", e.Tag)
			p.mixer.Skip()
			break
		}
		if p.now != nil {
			p.fading[p.now.ID] = p.now
		}
		p.now = it
		p.nowStarted = p.deps.Now()
		p.nextTag = ""
		p.skipped = ""
		p.votes.Reset()
		p.armPlayedLocked(it)
		p.stopIdleLocked()
		p.ensurePreparingLocked()
		p.ensureVideosLocked()
	case EventEnded:
		if it, ok := p.fading[e.Tag]; ok {
			delete(p.fading, e.Tag)
			removeFiles(it)
		} else if p.now != nil && p.now.ID == e.Tag {
			removeFiles(p.now)
			p.now = nil
		}
		p.idleIfEmptyLocked()
	}
	p.deps.Notify.PublishState(p)
	p.mu.Unlock()
}

// Enqueue põe itens no fim da fila e começa a preparar o primeiro da fila.
func (p *Player) Enqueue(items []*Item, textChannelID string) (EnqueueResult, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.closed {
		return EnqueueResult{}, errors.New("player encerrado")
	}
	idleBefore := p.now == nil && p.queue.Len() == 0
	added, pos, err := p.queue.Add(items...)
	if err != nil {
		return EnqueueResult{}, err
	}
	p.lastText = textChannelID
	p.stopIdleLocked()
	var addedMs int64
	for _, it := range items[:added] {
		addedMs += it.Track.DurationMs
	}
	res := EnqueueResult{Added: added, FirstPos: pos, StartsNow: idleBefore && pos == 1, AddedMs: addedMs}
	if !res.StartsNow {
		res.StartsInMs = StartsIn(p.remainingLocked(), p.queue.Items(), pos, p.deps.Crossfade.Milliseconds())
	}
	p.ensurePreparingLocked()
	p.deps.Notify.PublishState(p)
	return res, nil
}

func (p *Player) remainingLocked() int64 {
	if p.now == nil {
		return 0
	}
	left := p.now.Track.DurationMs - p.deps.Now().Sub(p.nowStarted).Milliseconds()
	if left < 0 {
		return 0
	}
	return left
}

// ensurePreparingLocked baixa e prepara o primeiro da fila, se ninguém está.
func (p *Player) ensurePreparingLocked() {
	head := p.queue.Head()
	if head == nil || p.nextTag != "" {
		return
	}
	if _, busy := p.preparing[head.ID]; busy {
		return
	}
	ctx, cancel := context.WithTimeout(p.ctx, downloadTimeout)
	p.preparing[head.ID] = cancel
	go func(it *Item) {
		path, err := p.deps.Source.DownloadAudio(ctx, it.Track.VideoID, p.deps.CacheDir)
		var r io.ReadCloser
		if err == nil {
			r, err = p.deps.Prepare(p.ctx, path)
		}
		cancel()
		p.onPrepared(it, path, r, err)
	}(head)
}

func (p *Player) onPrepared(it *Item, path string, r io.ReadCloser, err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.preparing, it.ID)
	if p.closed {
		closeQuiet(r)
		return
	}
	head := p.queue.Head()
	if head == nil || head.ID != it.ID {
		// Saiu da fila ou foi trocado de lugar enquanto baixava.
		closeQuiet(r)
		p.ensurePreparingLocked()
		p.idleIfEmptyLocked()
		return
	}
	if err != nil {
		log.Printf("[music] falha ao preparar %s: %v", it.Track.VideoID, err)
		p.queue.PopHead()
		removeFiles(it)
		p.deps.Notify.Public(it.TextChannelID, TextFailed(it.Track.Title, it.RequestedBy.Username, p.ChannelName))
		p.ensurePreparingLocked()
		if p.now == nil && p.queue.Len() == 0 && len(p.preparing) == 0 {
			p.startIdleLocked()
		}
		p.deps.Notify.PublishState(p)
		return
	}
	it.AudioPath = path
	p.nextTag = it.ID
	p.mixer.SetNext(it.ID, r)
}

func (p *Player) Skip(userID string) SkipResult {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.now == nil || p.closed {
		return SkipResult{Kind: SkipNothing}
	}
	if p.skipped == p.now.ID {
		return SkipResult{Kind: SkipDone}
	}
	if p.now.RequestedBy.ID == userID {
		p.deps.Notify.Public(p.lastTextFor(p.now), TextSkippedBy(p.now.Track.Title, p.now.RequestedBy.Username, p.ChannelName))
		p.skipped = p.now.ID
		p.mixer.Skip()
		return SkipResult{Kind: SkipDone}
	}
	humans := p.deps.Notify.Humans(p.CallID)
	p.votes.Prune(humans)
	added := p.votes.Add(userID)
	needed := NeededVotes(len(humans))
	votes := p.votes.Count()
	if votes >= needed {
		p.skipByVoteLocked(votes, needed)
		return SkipResult{Kind: SkipDone, Votes: votes, Needed: needed}
	}
	p.deps.Notify.PublishState(p)
	if !added {
		return SkipResult{Kind: SkipAlready, Votes: votes, Needed: needed}
	}
	return SkipResult{Kind: SkipVoted, Votes: votes, Needed: needed}
}

func (p *Player) skipByVoteLocked(votes, needed int) {
	if p.skipped == p.now.ID {
		return
	}
	p.skipped = p.now.ID
	p.deps.Notify.Public(p.lastTextFor(p.now), TextSkippedByVote(p.now.Track.Title, votes, needed, p.ChannelName))
	p.votes.Reset()
	p.mixer.Skip()
}

// lastTextFor: o aviso vai para o canal de onde a música foi pedida.
func (p *Player) lastTextFor(it *Item) string {
	if it != nil && it.TextChannelID != "" {
		return it.TextChannelID
	}
	return p.lastText
}

// ParticipantLeft recalcula a votação: com menos gente, metade pode já bastar.
func (p *Player) ParticipantLeft(userID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.watchers, userID)
	if p.now == nil || p.closed {
		return
	}
	humans := p.deps.Notify.Humans(p.CallID)
	p.votes.Prune(humans)
	needed := NeededVotes(len(humans))
	if votes := p.votes.Count(); votes > 0 && votes >= needed {
		p.skipByVoteLocked(votes, needed)
	}
	p.deps.Notify.PublishState(p)
}

func (p *Player) Remove(itemID, userID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	it, err := p.queue.Remove(itemID, userID)
	if err != nil {
		return err
	}
	p.dropPreparedLocked(it.ID)
	removeFiles(it)
	p.ensurePreparingLocked()
	p.idleIfEmptyLocked()
	p.deps.Notify.PublishState(p)
	return nil
}

func (p *Player) Swap(a, b, userID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	var oldHead string
	if h := p.queue.Head(); h != nil {
		oldHead = h.ID
	}
	if err := p.queue.Swap(a, b, userID); err != nil {
		return err
	}
	if h := p.queue.Head(); h != nil && h.ID != oldHead {
		p.dropPreparedLocked(oldHead)
	}
	p.ensurePreparingLocked()
	p.idleIfEmptyLocked()
	p.deps.Notify.PublishState(p)
	return nil
}

// dropPreparedLocked desfaz o que já estava pronto/baixando para esse item.
func (p *Player) dropPreparedLocked(itemID string) {
	if p.nextTag == itemID {
		p.mixer.ClearNext()
		p.nextTag = ""
	}
	if cancel, ok := p.preparing[itemID]; ok {
		cancel()
	}
}

func (p *Player) Snapshot() Snapshot {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.snapshotLocked()
}

func (p *Player) snapshotLocked() Snapshot {
	s := Snapshot{Voters: p.votes.Voters()}
	// Cópias: quem lê o Snapshot fora do lock não corre com escritas em VideoPath.
	for _, it := range p.queue.Items() {
		cp := *it
		s.Queue = append(s.Queue, &cp)
	}
	if p.now != nil {
		cp := *p.now
		s.Now, s.StartedAt = &cp, p.nowStarted
	}
	s.Needed = NeededVotes(len(p.deps.Notify.Humans(p.CallID)))
	return s
}

// idleIfEmptyLocked arma o timer quando não há nada tocando, na fila nem sendo preparado.
func (p *Player) idleIfEmptyLocked() {
	if p.now == nil && p.queue.Len() == 0 && len(p.preparing) == 0 {
		p.startIdleLocked()
	}
}

func (p *Player) startIdleLocked() {
	if p.idle != nil {
		return
	}
	var t *time.Timer
	t = time.AfterFunc(p.deps.IdleTimeout, func() {
		// Se o timer foi parado/substituído enquanto esperava o lock, não fecha.
		p.mu.Lock()
		stale := p.idle != t
		p.mu.Unlock()
		if !stale {
			p.shutdown(false)
		}
	})
	p.idle = t
}

func (p *Player) stopIdleLocked() {
	if p.idle != nil {
		p.idle.Stop()
		p.idle = nil
	}
}

// IdleIfEmpty arma o timer de ociosidade se não há nada tocando nem na fila.
func (p *Player) IdleIfEmpty() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.closed {
		p.idleIfEmptyLocked()
	}
}

func (p *Player) IsClosed() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.closed
}

// Close encerra o player (call acabou). Pode ser chamado mais de uma vez.
func (p *Player) Close() { p.shutdown(false) }

func (p *Player) shutdown(crashed bool) {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return
	}
	p.closed = true
	p.stopIdleLocked()
	for _, cancel := range p.preparing {
		cancel()
	}
	if crashed {
		p.deps.Notify.Public(p.lastTextFor(p.now), TextCrashed(p.ChannelName))
	}
	p.mu.Unlock()

	if p.cancel != nil {
		p.cancel()
	}
	if p.mixer != nil {
		p.mixer.Close()
	}
	if p.out != nil {
		p.out.Close()
	}
	_ = os.RemoveAll(p.deps.CacheDir)
	p.deps.Notify.Closed(p)
}

func removeFiles(it *Item) {
	for _, f := range []string{it.AudioPath, it.VideoPath} {
		if f != "" {
			_ = os.Remove(f)
		}
	}
}

func closeQuiet(r io.ReadCloser) {
	if r != nil {
		_ = r.Close()
	}
}
