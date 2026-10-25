package proposal

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"testing"
	"time"
)

var t0 = time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)

type fakeStore struct {
	items map[string]*Proposal
	votes map[string]map[string]bool // proposal -> user -> approve
	seq   int

	// imagens: id -> {dono do upload, proposta (vazio = pendente)}
	images map[string]fakeImage

	comments []*Comment
	// menções: comment -> user -> visto
	mentions  map[string]map[string]bool
	blocked   map[string]bool // usuários que não podem ser marcados
	mentionOK map[string]bool // usuários que existem
}

type fakeImage struct{ uploader, proposal string }

func newFakeStore() *fakeStore {
	return &fakeStore{
		items:     map[string]*Proposal{},
		votes:     map[string]map[string]bool{},
		images:    map[string]fakeImage{},
		mentions:  map[string]map[string]bool{},
		blocked:   map[string]bool{},
		mentionOK: map[string]bool{"u1": true, "u2": true, "u3": true, "tech": true},
	}
}

func (f *fakeStore) view(p *Proposal, viewer *string) *Proposal {
	c := *p
	c.YesVotes, c.NoVotes, c.MyVote = 0, 0, nil
	for uid, ok := range f.votes[p.ID] {
		if ok {
			c.YesVotes++
		} else {
			c.NoVotes++
		}
		if viewer != nil && *viewer == uid {
			v := ok
			c.MyVote = &v
		}
	}
	c.Images = []Image{}
	for id, img := range f.images {
		if img.proposal == p.ID {
			c.Images = append(c.Images, Image{ID: id, URL: imageURL(id)})
		}
	}
	slices.SortFunc(c.Images, func(a, b Image) int {
		if a.ID < b.ID {
			return -1
		}
		return 1
	})
	for _, cm := range f.comments {
		if cm.ProposalID == p.ID {
			c.CommentCount++
		}
	}
	return &c
}

func (f *fakeStore) List(_ context.Context, viewerID string) ([]Proposal, error) {
	var out []Proposal
	for _, p := range f.items {
		out = append(out, *f.view(p, &viewerID))
	}
	return out, nil
}

func (f *fakeStore) Get(_ context.Context, id string, viewer *string) (*Proposal, error) {
	p, ok := f.items[id]
	if !ok {
		return nil, ErrNotFound
	}
	return f.view(p, viewer), nil
}

// attach deixa o card com as imagens dadas; false se alguma não vale.
func (f *fakeStore) attach(proposalID, uploader string, ids []string) (removed []string, ok bool) {
	for _, id := range ids {
		img, exists := f.images[id]
		if !exists || !(img.proposal == proposalID || (img.proposal == "" && img.uploader == uploader)) {
			return nil, false
		}
	}
	for id, img := range f.images {
		if img.proposal == proposalID && !slices.Contains(ids, id) {
			removed = append(removed, id)
			delete(f.images, id)
		}
	}
	for _, id := range ids {
		f.images[id] = fakeImage{uploader: f.images[id].uploader, proposal: proposalID}
	}
	return removed, true
}

func (f *fakeStore) CreateWithLimit(_ context.Context, authorID, title, description string, endsAt, now time.Time, max int, imageIDs []string) (string, error) {
	open := 0
	for _, p := range f.items {
		if p.AuthorID == authorID && p.IsOpen(now) {
			open++
		}
	}
	if open >= max {
		return "", ErrTooManyOpen
	}
	f.seq++
	id := "p" + strconv.Itoa(f.seq)
	if _, ok := f.attach(id, authorID, imageIDs); !ok {
		return "", ErrInvalidImage
	}
	f.items[id] = &Proposal{ID: id, AuthorID: authorID, Title: title, Description: description,
		Status: StatusVoting, CreatedAt: t0, VotingEndsAt: endsAt}
	return id, nil
}

func (f *fakeStore) Update(_ context.Context, id, editorID, title, description string, imageIDs []string) ([]string, error) {
	removed, ok := f.attach(id, editorID, imageIDs)
	if !ok {
		return nil, ErrInvalidImage
	}
	p := f.items[id]
	p.Title, p.Description = title, description
	edited := t0
	p.EditedAt = &edited
	return removed, nil
}

func (f *fakeStore) UpsertVote(_ context.Context, id, userID string, approve bool, now time.Time) (bool, error) {
	p := f.items[id]
	if p == nil || !p.IsOpen(now) {
		return false, nil
	}
	if f.votes[id] == nil {
		f.votes[id] = map[string]bool{}
	}
	f.votes[id][userID] = approve
	return true, nil
}

func (f *fakeStore) DeleteVote(_ context.Context, id, userID string, now time.Time) (bool, error) {
	p := f.items[id]
	if p == nil || !p.IsOpen(now) {
		return false, nil
	}
	_, had := f.votes[id][userID]
	delete(f.votes[id], userID)
	return had, nil
}

func (f *fakeStore) Delete(_ context.Context, id string) error {
	delete(f.items, id)
	for imgID, img := range f.images {
		if img.proposal == id {
			delete(f.images, imgID)
		}
	}
	return nil
}

func (f *fakeStore) SetStatus(_ context.Context, id, status string) error {
	p := f.items[id]
	p.Status = status
	if p.ClosedAt == nil {
		closed := t0
		p.ClosedAt = &closed
	}
	return nil
}

func (f *fakeStore) CloseDue(_ context.Context, now time.Time) ([]string, error) {
	var ids []string
	for id, p := range f.items {
		if p.Status != StatusVoting || p.VotingEndsAt.After(now) {
			continue
		}
		if f.view(p, nil).Approved() {
			p.Status = StatusProposed
		} else {
			p.Status = StatusRejected
		}
		closed := now
		p.ClosedAt = &closed
		ids = append(ids, id)
	}
	return ids, nil
}

func (f *fakeStore) WithoutIssue(context.Context) ([]Proposal, error) {
	var out []Proposal
	for _, p := range f.items {
		if p.GithubIssueURL == nil && (p.Status == StatusProposed || p.Status == StatusInProgress || p.Status == StatusDone) {
			out = append(out, *f.view(p, nil))
		}
	}
	return out, nil
}

func (f *fakeStore) SetIssue(_ context.Context, id string, number int, url string) error {
	f.items[id].GithubIssueNumber = &number
	f.items[id].GithubIssueURL = &url
	return nil
}

func (f *fakeStore) CreateImage(_ context.Context, id, uploaderID, _ string, _ int64) error {
	f.images[id] = fakeImage{uploader: uploaderID}
	return nil
}

func (f *fakeStore) ImageIDs(_ context.Context, proposalID string) ([]string, error) {
	var ids []string
	for id, img := range f.images {
		if img.proposal == proposalID {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func (f *fakeStore) ImageContentType(_ context.Context, id string) (string, error) {
	if _, ok := f.images[id]; !ok {
		return "", ErrNotFound
	}
	return "image/png", nil
}

func (f *fakeStore) DeletePendingImages(context.Context, time.Time) ([]string, error) {
	var ids []string
	for id, img := range f.images {
		if img.proposal == "" {
			ids = append(ids, id)
			delete(f.images, id)
		}
	}
	return ids, nil
}

func (f *fakeStore) ListComments(_ context.Context, proposalID string) ([]Comment, error) {
	out := []Comment{}
	for _, c := range f.comments {
		if c.ProposalID == proposalID {
			out = append(out, *c)
		}
	}
	return out, nil
}

func (f *fakeStore) GetComment(_ context.Context, id string) (*Comment, error) {
	for _, c := range f.comments {
		if c.ID == id {
			cp := *c
			return &cp, nil
		}
	}
	return nil, ErrCommentNotFound
}

func (f *fakeStore) CreateComment(_ context.Context, proposalID, authorID, body string, mentionIDs []string) (string, error) {
	id := "c" + strconv.Itoa(len(f.comments)+1)
	c := &Comment{ID: id, ProposalID: proposalID, AuthorID: authorID, AuthorName: authorID, Body: body,
		CreatedAt: t0, Mentions: []Mention{}}
	f.comments = append(f.comments, c)
	f.mentions[id] = map[string]bool{}
	for _, uid := range mentionIDs {
		f.mentions[id][uid] = false
		c.Mentions = append(c.Mentions, Mention{ID: uid})
	}
	return id, nil
}

func (f *fakeStore) UpdateComment(_ context.Context, id, body string) error {
	for _, c := range f.comments {
		if c.ID == id {
			c.Body = body
			edited := t0
			c.EditedAt = &edited
			return nil
		}
	}
	return ErrCommentNotFound
}

func (f *fakeStore) DeleteComment(_ context.Context, id string) error {
	f.comments = slices.DeleteFunc(f.comments, func(c *Comment) bool { return c.ID == id })
	delete(f.mentions, id)
	return nil
}

func (f *fakeStore) CountRecentComments(_ context.Context, authorID string, _ time.Time) (int, error) {
	n := 0
	for _, c := range f.comments {
		if c.AuthorID == authorID {
			n++
		}
	}
	return n, nil
}

func (f *fakeStore) MentionableUsers(_ context.Context, authorID string, ids []string) ([]string, error) {
	var out []string
	for _, id := range ids {
		if id != authorID && f.mentionOK[id] && !f.blocked[id] {
			out = append(out, id)
		}
	}
	return out, nil
}

func (f *fakeStore) UnseenMentions(_ context.Context, userID string) ([]PendingMention, error) {
	out := []PendingMention{}
	for _, c := range f.comments {
		if seen, ok := f.mentions[c.ID][userID]; ok && !seen {
			out = append(out, PendingMention{ProposalID: c.ProposalID, CommentID: c.ID})
		}
	}
	return out, nil
}

func (f *fakeStore) MarkMentionsSeen(_ context.Context, userID string, proposalID *string) error {
	for _, c := range f.comments {
		if proposalID != nil && c.ProposalID != *proposalID {
			continue
		}
		if _, ok := f.mentions[c.ID][userID]; ok {
			f.mentions[c.ID][userID] = true
		}
	}
	return nil
}

type fakePublisher struct {
	events int
	users  map[string][][]byte
}

func (f *fakePublisher) BroadcastAll([]byte) { f.events++ }

func (f *fakePublisher) SendToUser(userID string, event []byte) {
	if f.users == nil {
		f.users = map[string][][]byte{}
	}
	f.users[userID] = append(f.users[userID], event)
}

type fakeFiles struct{ removed []string }

func (f *fakeFiles) Remove(name string) error {
	f.removed = append(f.removed, name)
	return nil
}

type fakeIssues struct {
	calls int
	fail  bool
}

func (f *fakeIssues) CreateIssue(context.Context, Proposal) (int, string, error) {
	f.calls++
	if f.fail {
		return 0, "", errors.New("github fora do ar")
	}
	return 7, "https://github.com/o/r/issues/7", nil
}

func newTestService(issues IssueCreator) (*Service, *fakeStore, *fakePublisher) {
	st, pub := newFakeStore(), &fakePublisher{}
	s := newService(st, pub, issues, []string{"tech"})
	s.now = func() time.Time { return t0 }
	return s, st, pub
}

func TestCreateValidatesAndLimits(t *testing.T) {
	s, _, pub := newTestService(nil)
	ctx := context.Background()

	if _, err := s.Create(ctx, "u1", "  ab ", "", nil); !errors.Is(err, ErrInvalidTitle) {
		t.Fatalf("título curto: got %v", err)
	}
	for i := range MaxOpenPerUser {
		if _, err := s.Create(ctx, "u1", "Modo escuro melhor", "", nil); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}
	if _, err := s.Create(ctx, "u1", "Mais uma ideia", "", nil); !errors.Is(err, ErrTooManyOpen) {
		t.Fatalf("limite: got %v", err)
	}
	if _, err := s.Create(ctx, "u2", "Ideia de outra pessoa", "", nil); err != nil {
		t.Fatalf("o limite é por pessoa: %v", err)
	}
	if pub.events != MaxOpenPerUser+1 {
		t.Fatalf("eventos publicados = %d", pub.events)
	}
}

func TestLimitFreesWhenVotingEnds(t *testing.T) {
	s, st, _ := newTestService(nil)
	ctx := context.Background()
	var first *Proposal
	for range MaxOpenPerUser {
		first, _ = s.Create(ctx, "u1", "Modo escuro melhor", "", nil)
	}
	// Mover para fora da votação libera a vaga (só conta o que está em votação).
	st.items[first.ID].Status = StatusProposed
	if _, err := s.Create(ctx, "u1", "Cabe de novo", "", nil); err != nil {
		t.Fatalf("a vaga deveria ter liberado: %v", err)
	}
}

func TestCreateImages(t *testing.T) {
	s, st, _ := newTestService(nil)
	ctx := context.Background()
	for _, id := range []string{"i1", "i2", "i3", "i4", "i5"} {
		_ = s.RegisterImage(ctx, id, "u1", "image/png", 10)
	}
	_ = s.RegisterImage(ctx, "alheia", "u2", "image/png", 10)

	if _, err := s.Create(ctx, "u1", "Com muitas imagens", "", []string{"i1", "i2", "i3", "i4", "i5"}); !errors.Is(err, ErrInvalidImage) {
		t.Fatalf("mais que o máximo: got %v", err)
	}
	if _, err := s.Create(ctx, "u1", "Imagem repetida", "", []string{"i1", "i1"}); !errors.Is(err, ErrInvalidImage) {
		t.Fatalf("repetida: got %v", err)
	}
	if _, err := s.Create(ctx, "u1", "Imagem de outro", "", []string{"alheia"}); !errors.Is(err, ErrInvalidImage) {
		t.Fatalf("imagem de outra pessoa: got %v", err)
	}
	if len(st.items) != 0 {
		t.Fatalf("pedido inválido não pode criar proposta: %d", len(st.items))
	}
	p, err := s.Create(ctx, "u1", "Com imagens", "", []string{"i2", "i1"})
	if err != nil || len(p.Images) != 2 {
		t.Fatalf("criar com imagens: %+v %v", p, err)
	}
}

func TestUpdatePermissions(t *testing.T) {
	s, st, _ := newTestService(nil)
	files := &fakeFiles{}
	s.files = files
	ctx := context.Background()
	_ = s.RegisterImage(ctx, "i1", "u1", "image/png", 10)
	_ = s.RegisterImage(ctx, "i2", "tech", "image/png", 10)
	p, _ := s.Create(ctx, "u1", "Título original", "desc", []string{"i1"})

	if _, err := s.Update(ctx, p.ID, "u2", "Hack", "", nil); !errors.Is(err, ErrForbidden) {
		t.Fatalf("outra pessoa: got %v", err)
	}
	if _, err := s.Update(ctx, p.ID, "u1", "ab", "", nil); !errors.Is(err, ErrInvalidTitle) {
		t.Fatalf("título curto: got %v", err)
	}
	got, err := s.Update(ctx, p.ID, "u1", "Título novo", "nova", nil)
	if err != nil || got.Title != "Título novo" || got.EditedAt == nil || len(got.Images) != 0 {
		t.Fatalf("autor em votação: %+v %v", got, err)
	}
	if !slices.Equal(files.removed, []string{"i1"}) {
		t.Fatalf("imagem removida deveria apagar o arquivo: %v", files.removed)
	}

	st.items[p.ID].Status = StatusProposed
	if _, err := s.Update(ctx, p.ID, "u1", "Depois do fim", "", nil); !errors.Is(err, ErrForbidden) {
		t.Fatalf("autor depois da votação: got %v", err)
	}
	got, err = s.Update(ctx, p.ID, "tech", "Editado pelo time", "", []string{"i2"})
	if err != nil || got.Title != "Editado pelo time" || len(got.Images) != 1 {
		t.Fatalf("tech edita sempre: %+v %v", got, err)
	}
}

func TestVoteChangeAndClosed(t *testing.T) {
	s, st, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Atalho novo", "", nil)

	got, err := s.Vote(ctx, p.ID, "u2", true)
	if err != nil || got.YesVotes != 1 || got.MyVote == nil || !*got.MyVote {
		t.Fatalf("voto sim: %+v %v", got, err)
	}
	got, _ = s.Vote(ctx, p.ID, "u2", false)
	if got.YesVotes != 0 || got.NoVotes != 1 {
		t.Fatalf("trocar voto deveria mover o voto: %+v", got)
	}
	got, _ = s.RemoveVote(ctx, p.ID, "u2")
	if got.YesVotes+got.NoVotes != 0 || got.MyVote != nil {
		t.Fatalf("retirar voto: %+v", got)
	}

	st.items[p.ID].VotingEndsAt = t0.Add(-time.Second)
	if _, err := s.Vote(ctx, p.ID, "u2", true); !errors.Is(err, ErrVotingClosed) {
		t.Fatalf("votar depois do prazo: got %v", err)
	}
	if _, err := s.Vote(ctx, "nope", "u2", true); !errors.Is(err, ErrNotFound) {
		t.Fatalf("proposta inexistente: got %v", err)
	}
}

func TestTickClosesByMajority(t *testing.T) {
	issues := &fakeIssues{}
	s, st, _ := newTestService(issues)
	ctx := context.Background()

	win, _ := s.Create(ctx, "u1", "Vence por 2 a 1", "", nil)
	tie, _ := s.Create(ctx, "u1", "Empata em 1 a 1", "", nil)
	none, _ := s.Create(ctx, "u1", "Ninguém votou", "", nil)
	s.Vote(ctx, win.ID, "a", true)
	s.Vote(ctx, win.ID, "b", true)
	s.Vote(ctx, win.ID, "c", false)
	s.Vote(ctx, tie.ID, "a", true)
	s.Vote(ctx, tie.ID, "b", false)

	// Antes do prazo nada fecha.
	s.Tick(ctx)
	if st.items[win.ID].Status != StatusVoting {
		t.Fatal("fechou antes do prazo")
	}

	s.now = func() time.Time { return t0.Add(VotingDuration) }
	s.Tick(ctx)

	for id, want := range map[string]string{win.ID: StatusProposed, tie.ID: StatusRejected, none.ID: StatusRejected} {
		if got := st.items[id].Status; got != want {
			t.Errorf("proposta %s: status %s, esperado %s", id, got, want)
		}
	}
	if issues.calls != 1 || st.items[win.ID].GithubIssueURL == nil {
		t.Fatalf("só a aprovada ganha issue: calls=%d", issues.calls)
	}

	// Outro tick não duplica a issue.
	s.Tick(ctx)
	if issues.calls != 1 {
		t.Fatalf("issue duplicada: calls=%d", issues.calls)
	}
}

func TestIssueRetriedAfterFailure(t *testing.T) {
	issues := &fakeIssues{fail: true}
	s, st, _ := newTestService(issues)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Aprovada com GitHub fora", "", nil)
	s.Vote(ctx, p.ID, "a", true)

	s.now = func() time.Time { return t0.Add(VotingDuration) }
	s.Tick(ctx)
	if st.items[p.ID].Status != StatusProposed || st.items[p.ID].GithubIssueURL != nil {
		t.Fatal("deveria ficar proposta, sem issue")
	}

	issues.fail = false
	s.Tick(ctx)
	if st.items[p.ID].GithubIssueURL == nil {
		t.Fatal("a issue deveria sair na nova tentativa")
	}
}

func TestSetStatusOnlyTech(t *testing.T) {
	s, st, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Algo para o time", "", nil)
	st.items[p.ID].Status = StatusProposed

	if _, err := s.SetStatus(ctx, p.ID, "u1", StatusInProgress); !errors.Is(err, ErrForbidden) {
		t.Fatalf("não-tech: got %v", err)
	}
	got, err := s.SetStatus(ctx, p.ID, "tech", StatusInProgress)
	if err != nil || got.Status != StatusInProgress {
		t.Fatalf("mover: %+v %v", got, err)
	}
	if got, err = s.SetStatus(ctx, p.ID, "tech", StatusDone); err != nil || got.Status != StatusDone {
		t.Fatalf("pular coluna é permitido: %+v %v", got, err)
	}
	if _, err = s.SetStatus(ctx, p.ID, "tech", StatusDone); !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("mesma coluna: got %v", err)
	}
	if _, err = s.SetStatus(ctx, p.ID, "tech", StatusVoting); !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("voltar para votação: got %v", err)
	}
	if _, err = s.SetStatus(ctx, p.ID, "tech", "lixo"); !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("status desconhecido: got %v", err)
	}
}

func TestSetStatusEarlyOpensIssue(t *testing.T) {
	issues := &fakeIssues{}
	s, st, _ := newTestService(issues)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Ainda em votação", "", nil)

	got, err := s.SetStatus(ctx, p.ID, "tech", StatusProposed)
	if err != nil || got.Status != StatusProposed {
		t.Fatalf("mover antes do prazo: %+v %v", got, err)
	}
	if st.items[p.ID].ClosedAt == nil {
		t.Fatal("sair da votação precisa marcar o fechamento")
	}
	if issues.calls != 1 || got.GithubIssueURL == nil {
		t.Fatalf("a issue sai na hora: calls=%d url=%v", issues.calls, got.GithubIssueURL)
	}

	// Mover de novo não recria a issue.
	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusInProgress); err != nil {
		t.Fatal(err)
	}
	if issues.calls != 1 {
		t.Fatalf("issue duplicada: calls=%d", issues.calls)
	}
}

func TestSetStatusIssueFailureKeepsMove(t *testing.T) {
	issues := &fakeIssues{fail: true}
	s, st, _ := newTestService(issues)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "GitHub fora do ar", "", nil)

	got, err := s.SetStatus(ctx, p.ID, "tech", StatusProposed)
	if err != nil || got.Status != StatusProposed || got.GithubIssueURL != nil {
		t.Fatalf("o card fica movido mesmo sem issue: %+v %v", got, err)
	}
	issues.fail = false
	s.Tick(ctx)
	if st.items[p.ID].GithubIssueURL == nil {
		t.Fatal("o Tick deveria criar a issue depois")
	}
}

func TestSetStatusRejectedHasNoIssue(t *testing.T) {
	issues := &fakeIssues{}
	s, _, _ := newTestService(issues)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Vai ser recusada", "", nil)
	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusRejected); err != nil {
		t.Fatal(err)
	}
	if issues.calls != 0 {
		t.Fatalf("recusada não ganha issue: calls=%d", issues.calls)
	}
}

func TestDeletePermissions(t *testing.T) {
	s, st, _ := newTestService(nil)
	files := &fakeFiles{}
	s.files = files
	ctx := context.Background()
	_ = s.RegisterImage(ctx, "i1", "u1", "image/png", 10)
	p, _ := s.Create(ctx, "u1", "Para apagar", "", []string{"i1"})

	if err := s.Delete(ctx, p.ID, "u2"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("outra pessoa: got %v", err)
	}
	st.items[p.ID].Status = StatusProposed
	if err := s.Delete(ctx, p.ID, "u1"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("autor depois da votação: got %v", err)
	}
	if err := s.Delete(ctx, p.ID, "tech"); err != nil {
		t.Fatalf("tech apaga sempre: %v", err)
	}
	if !slices.Equal(files.removed, []string{"i1"}) {
		t.Fatalf("apagar a proposta apaga os arquivos: %v", files.removed)
	}
}

func TestPendingImagesCleaned(t *testing.T) {
	s, st, _ := newTestService(nil)
	files := &fakeFiles{}
	s.files = files
	ctx := context.Background()
	_ = s.RegisterImage(ctx, "solta", "u1", "image/png", 10)
	s.Tick(ctx)
	if _, ok := st.images["solta"]; ok || !slices.Equal(files.removed, []string{"solta"}) {
		t.Fatalf("imagem pendente deveria sumir: %v", files.removed)
	}
}

func TestCommentsAndMentions(t *testing.T) {
	s, st, pub := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Card com conversa", "", nil)
	st.blocked["u3"] = true

	if _, err := s.AddComment(ctx, p.ID, "u2", "   ", nil); !errors.Is(err, ErrInvalidComment) {
		t.Fatalf("comentário vazio: got %v", err)
	}
	if _, err := s.AddComment(ctx, "nope", "u2", "oi", nil); !errors.Is(err, ErrNotFound) {
		t.Fatalf("proposta inexistente: got %v", err)
	}
	// u2 marca o autor do card, ele mesmo, um bloqueado e alguém que não existe.
	c, err := s.AddComment(ctx, p.ID, "u2", "olha isso @u1 @u2 @u3", []string{"u1", "u2", "u3", "fantasma"})
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Mentions) != 1 || c.Mentions[0].ID != "u1" {
		t.Fatalf("só u1 pode ser marcado: %+v", c.Mentions)
	}
	if len(pub.users["u1"]) != 1 || len(pub.users["u2"]) != 0 || len(pub.users["u3"]) != 0 {
		t.Fatalf("só quem foi marcado é avisado: %v", pub.users)
	}
	if got, _ := st.Get(ctx, p.ID, nil); got.CommentCount != 1 {
		t.Fatalf("contagem de comentários: %d", got.CommentCount)
	}

	pending, _ := s.PendingMentions(ctx, "u1")
	if len(pending) != 1 {
		t.Fatalf("menções pendentes: %+v", pending)
	}
	_ = s.MarkMentionsSeen(ctx, "u1", &p.ID)
	if pending, _ = s.PendingMentions(ctx, "u1"); len(pending) != 0 {
		t.Fatalf("depois de ver: %+v", pending)
	}

	tooMany := make([]string, MaxMentionsPerComment+1)
	if _, err := s.AddComment(ctx, p.ID, "u2", "muita gente", tooMany); !errors.Is(err, ErrInvalidComment) {
		t.Fatalf("muitas menções: got %v", err)
	}
}

func TestCommentPermissions(t *testing.T) {
	s, _, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Card com conversa", "", nil)
	other, _ := s.Create(ctx, "u1", "Outro card", "", nil)
	c, _ := s.AddComment(ctx, p.ID, "u2", "meu comentário", nil)

	if _, err := s.EditComment(ctx, p.ID, c.ID, "u1", "invadi"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("editar comentário alheio (até o dono do card): got %v", err)
	}
	if _, err := s.EditComment(ctx, other.ID, c.ID, "u2", "outro card"); !errors.Is(err, ErrCommentNotFound) {
		t.Fatalf("comentário de outra proposta: got %v", err)
	}
	got, err := s.EditComment(ctx, p.ID, c.ID, "u2", "editado")
	if err != nil || got.Body != "editado" || got.EditedAt == nil {
		t.Fatalf("autor edita: %+v %v", got, err)
	}
	if err := s.DeleteComment(ctx, p.ID, c.ID, "u3"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("terceiro não apaga: got %v", err)
	}
	if err := s.DeleteComment(ctx, p.ID, c.ID, "tech"); err != nil {
		t.Fatalf("tech apaga qualquer comentário: %v", err)
	}
	if list, _ := s.Comments(ctx, p.ID); len(list) != 0 {
		t.Fatalf("sobrou comentário: %+v", list)
	}
}

func TestCommentRateLimit(t *testing.T) {
	s, _, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Card movimentado", "", nil)
	for i := range CommentsPerMinute {
		if _, err := s.AddComment(ctx, p.ID, "u2", "comentário "+strconv.Itoa(i), nil); err != nil {
			t.Fatalf("comentário %d: %v", i, err)
		}
	}
	if _, err := s.AddComment(ctx, p.ID, "u2", "um a mais", nil); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("limite por minuto: got %v", err)
	}
}
