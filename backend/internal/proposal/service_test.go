package proposal

import (
	"context"
	"errors"
	"testing"
	"time"
)

var t0 = time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)

type fakeStore struct {
	items map[string]*Proposal
	votes map[string]map[string]bool // proposal -> user -> approve
	seq   int
}

func newFakeStore() *fakeStore {
	return &fakeStore{items: map[string]*Proposal{}, votes: map[string]map[string]bool{}}
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

func (f *fakeStore) Create(_ context.Context, authorID, title, description string, endsAt time.Time) (string, error) {
	f.seq++
	id := string(rune('a' + f.seq))
	f.items[id] = &Proposal{ID: id, AuthorID: authorID, Title: title, Description: description,
		Status: StatusVoting, CreatedAt: t0, VotingEndsAt: endsAt}
	return id, nil
}

func (f *fakeStore) CountOpenByAuthor(_ context.Context, authorID string, now time.Time) (int, error) {
	n := 0
	for _, p := range f.items {
		if p.AuthorID == authorID && p.IsOpen(now) {
			n++
		}
	}
	return n, nil
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
	return nil
}

func (f *fakeStore) SetStatus(_ context.Context, id, status string) error {
	f.items[id].Status = status
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

type fakePublisher struct{ events int }

func (f *fakePublisher) BroadcastAll([]byte) { f.events++ }

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

	if _, err := s.Create(ctx, "u1", "  ab ", ""); !errors.Is(err, ErrInvalidTitle) {
		t.Fatalf("título curto: got %v", err)
	}
	for i := range MaxOpenPerUser {
		if _, err := s.Create(ctx, "u1", "Modo escuro melhor", ""); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}
	if _, err := s.Create(ctx, "u1", "Mais uma ideia", ""); !errors.Is(err, ErrTooManyOpen) {
		t.Fatalf("limite: got %v", err)
	}
	if _, err := s.Create(ctx, "u2", "Ideia de outra pessoa", ""); err != nil {
		t.Fatalf("o limite é por pessoa: %v", err)
	}
	if pub.events != MaxOpenPerUser+1 {
		t.Fatalf("eventos publicados = %d", pub.events)
	}
}

func TestVoteChangeAndClosed(t *testing.T) {
	s, st, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Atalho novo", "")

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

	win, _ := s.Create(ctx, "u1", "Vence por 2 a 1", "")
	tie, _ := s.Create(ctx, "u1", "Empata em 1 a 1", "")
	none, _ := s.Create(ctx, "u1", "Ninguém votou", "")
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
	p, _ := s.Create(ctx, "u1", "Aprovada com GitHub fora", "")
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
	p, _ := s.Create(ctx, "u1", "Algo para o time", "")
	st.items[p.ID].Status = StatusProposed

	if _, err := s.SetStatus(ctx, p.ID, "u1", StatusInProgress); !errors.Is(err, ErrForbidden) {
		t.Fatalf("não-tech: got %v", err)
	}
	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusDone); !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("pular coluna: got %v", err)
	}
	got, err := s.SetStatus(ctx, p.ID, "tech", StatusInProgress)
	if err != nil || got.Status != StatusInProgress {
		t.Fatalf("mover: %+v %v", got, err)
	}
}

func TestDeletePermissions(t *testing.T) {
	s, st, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Para apagar", "")

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
}
