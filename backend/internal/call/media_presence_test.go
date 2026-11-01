package call

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"
)

// fakeRoster é a sala de mídia (LiveKit) de cada chamada nos testes.
type fakeRoster struct {
	mu    sync.Mutex
	rooms map[string][]string
	err   error
	asked int
}

func (f *fakeRoster) Identities(_ context.Context, room string) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.asked++
	if f.err != nil {
		return nil, f.err
	}
	return f.rooms[room], nil
}

func (f *fakeRoster) set(room string, identities ...string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rooms[room] = identities
}

// presenceFixture: chamada "call-1" com os participantes, sala de mídia vazia
// e um relógio que o teste avança.
type presenceFixture struct {
	service  *Service
	roster   *fakeRoster
	presence *MediaPresence
	clock    time.Time
	leftMu   *sync.Mutex
	left     *[]string
}

func newPresenceFixture(participantIDs ...string) *presenceFixture {
	f := &presenceFixture{
		service: serviceWithCall("call-1", participantIDs...),
		roster:  &fakeRoster{rooms: map[string][]string{}},
		clock:   time.Date(2026, 10, 28, 20, 0, 0, 0, time.UTC),
	}
	f.leftMu, f.left = recordLeaves(f.service)
	f.presence = NewMediaPresence(f.service, f.roster, func() time.Time { return f.clock })
	return f
}

func (f *presenceFixture) advance(d time.Duration) { f.clock = f.clock.Add(d) }

// sweepEvery avança o intervalo da varredura e varre.
func (f *presenceFixture) sweepEvery() {
	f.advance(MediaSweepEvery)
	f.presence.Sweep(context.Background())
}

func (f *presenceFixture) leaves() []string {
	f.leftMu.Lock()
	defer f.leftMu.Unlock()
	return append([]string{}, *f.left...)
}

func (f *presenceFixture) declare(userID string, callID any) {
	payload, _ := json.Marshal(map[string]any{"call_id": callID})
	f.presence.Router(f.service).HandleCallMessage(userID, "call:presence", payload)
}

func wantLeaves(t *testing.T, got []string, want ...string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("saídas = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("saídas = %v, want %v", got, want)
		}
	}
}

// Regressão #374: o app reabre (atualização, crash) e reconecta o WS dentro da
// tolerância, mas não volta à call. Ele avisa que não está em call nenhuma e,
// fora da sala de mídia, sai da chamada na hora.
func TestPresenceAppReopenedWithoutResumeLeavesCall(t *testing.T) {
	f := newPresenceFixture("ana", "bia")
	f.roster.set("call-1", "bia")

	f.declare("ana", nil)

	wantLeaves(t, f.leaves(), "call-1/ana")
}

// Outro aparelho da mesma pessoa que não está em call não tira quem está na
// mídia (o LiveKit é quem diz).
func TestPresenceDeclaredOutButInMediaStays(t *testing.T) {
	f := newPresenceFixture("ana")
	f.roster.set("call-1", "ana")

	f.declare("ana", nil)

	wantLeaves(t, f.leaves())
}

// Acabou de entrar (ainda conectando à mídia): o aviso de outro aparelho não tira.
func TestPresenceDeclaredOutRightAfterJoiningStays(t *testing.T) {
	f := newPresenceFixture("ana")
	f.service.calls["call-1"].participants["ana"].joinedAt = f.clock.Add(-5 * time.Second)

	f.declare("ana", nil)

	wantLeaves(t, f.leaves())
}

// Quem diz estar na call não sai por isso.
func TestPresenceInCallDoesNothing(t *testing.T) {
	f := newPresenceFixture("ana")

	f.declare("ana", "call-1")

	wantLeaves(t, f.leaves())
	if f.roster.asked != 0 {
		t.Fatalf("consultou o LiveKit %d vez(es) sem precisar", f.roster.asked)
	}
}

// Rede de segurança (clientes antigos ou travados): ausente da sala de mídia em
// duas varreduras seguidas, sai da chamada.
func TestSweepRemovesWhoIsMissingFromMediaTwice(t *testing.T) {
	f := newPresenceFixture("ana", "bia")
	f.roster.set("call-1", "bia")

	f.presence.Sweep(context.Background()) // primeira vez que vê a chamada
	f.advance(MediaJoinGrace)
	f.presence.Sweep(context.Background())
	wantLeaves(t, f.leaves())

	f.sweepEvery()
	wantLeaves(t, f.leaves(), "call-1/ana")
}

// Queda curta (a mídia reconecta entre uma varredura e outra) não tira ninguém.
func TestSweepShortDropKeepsParticipant(t *testing.T) {
	f := newPresenceFixture("ana")
	f.presence.Sweep(context.Background())
	f.advance(MediaJoinGrace)

	f.presence.Sweep(context.Background()) // ausente
	f.roster.set("call-1", "ana")
	f.sweepEvery() // voltou
	f.roster.set("call-1")
	f.sweepEvery() // caiu de novo: conta do zero

	wantLeaves(t, f.leaves())
}

// Quem acabou de entrar tem tempo para conectar à mídia.
func TestSweepGivesNewcomersTimeToConnect(t *testing.T) {
	f := newPresenceFixture("ana")

	f.presence.Sweep(context.Background())
	f.sweepEvery()

	wantLeaves(t, f.leaves())
}

// LiveKit fora do ar: ninguém sai.
func TestSweepKeepsEveryoneWhenMediaIsUnreachable(t *testing.T) {
	f := newPresenceFixture("ana")
	f.roster.err = errors.New("connection refused")

	f.presence.Sweep(context.Background())
	for i := 0; i < 5; i++ {
		f.sweepEvery()
	}

	wantLeaves(t, f.leaves())
}

// O app avisou que não está em call, mas a sessão antiga ainda aparecia na
// mídia (crash: o LiveKit demora a soltar). Na primeira ausência, sai.
func TestSweepDeclaredOutLeavesOnFirstAbsence(t *testing.T) {
	f := newPresenceFixture("ana")
	f.roster.set("call-1", "ana")
	f.presence.Sweep(context.Background())
	f.declare("ana", nil)
	f.advance(MediaJoinGrace)

	f.roster.set("call-1")
	f.presence.Sweep(context.Background())

	wantLeaves(t, f.leaves(), "call-1/ana")
}

// Voltou à call (o app avisa): o aviso anterior deixa de valer.
func TestSweepDeclarationClearedByBeingInCall(t *testing.T) {
	f := newPresenceFixture("ana")
	f.roster.set("call-1", "ana")
	f.presence.Sweep(context.Background())
	f.declare("ana", nil)
	f.declare("ana", "call-1")
	f.advance(MediaJoinGrace)

	f.roster.set("call-1")
	f.presence.Sweep(context.Background())

	wantLeaves(t, f.leaves())
}

// Visitante (#347) entra com a própria identidade no LiveKit e fica; o bot de
// música tem identidade própria e não é participante da chamada.
func TestSweepKeepsGuestAndIgnoresMusicBot(t *testing.T) {
	f := newPresenceFixture("ana", "visitante")
	f.roster.set("call-1", "ana", "visitante", "bot-music:canal-1")

	f.presence.Sweep(context.Background())
	f.advance(MediaJoinGrace)
	f.presence.Sweep(context.Background())
	f.sweepEvery()

	wantLeaves(t, f.leaves())
}

// Sala trancada: quem saiu por estar fora da mídia volta sem bater na porta,
// como numa queda do WS.
func TestMissingFromMediaCanRejoinLockedRoom(t *testing.T) {
	f := newPresenceFixture("ana", "bia")
	f.service.calls["call-1"].info.Locked = true
	f.service.leaveAfterDisconnect = func(_ context.Context, callID, userID string) error {
		delete(f.service.calls[callID].participants, userID)
		return nil
	}
	f.roster.set("call-1", "bia")

	f.declare("ana", nil)

	if _, still := f.service.calls["call-1"].participants["ana"]; still {
		t.Fatal("ana continua na chamada fora da mídia")
	}
	if !canEnterLockedLocked(f.service.calls["call-1"], "ana", f.clock) {
		t.Fatal("quem caiu da mídia teria de bater na porta para voltar")
	}
}

// Outras mensagens seguem para o roteador de baixo.
func TestPresenceRouterPassesOtherMessages(t *testing.T) {
	f := newPresenceFixture("ana")
	next := &recordingRouter{}

	f.presence.Router(next).HandleCallMessage("ana", "call:leave", json.RawMessage(`{"call_id":"call-1"}`))

	if len(next.types) != 1 || next.types[0] != "call:leave" {
		t.Fatalf("repassadas = %v", next.types)
	}
}

type recordingRouter struct{ types []string }

func (r *recordingRouter) HandleCallMessage(_ string, evType string, _ json.RawMessage) {
	r.types = append(r.types, evType)
}
func (r *recordingRouter) IsParticipant(string, string) bool { return false }

// signalRoster avisa a cada consulta (para o teste do Run).
type signalRoster struct{ asked chan struct{} }

func (r signalRoster) Identities(context.Context, string) ([]string, error) {
	select {
	case r.asked <- struct{}{}:
	default: // ninguém esperando: segue
	}
	return nil, nil
}

// Run varre a cada intervalo e para quando o contexto acaba.
func TestRunSweepsUntilCancelled(t *testing.T) {
	s := serviceWithCall("call-1", "ana")
	recordLeaves(s)
	roster := signalRoster{asked: make(chan struct{})}
	presence := NewMediaPresence(s, roster, time.Now)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})

	go func() {
		presence.Run(ctx, time.Millisecond)
		close(done)
	}()
	<-roster.asked
	<-roster.asked
	cancel()

	<-done
}
