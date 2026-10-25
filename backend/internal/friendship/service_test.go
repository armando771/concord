package friendship

import (
	"context"
	"errors"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/user"
)

// fakeStore guarda amizades e bloqueios em memória.
type fakeStore struct {
	rows   map[[2]string]*Friendship // chave: requester, addressee
	blocks map[[2]string]bool        // chave: blocker, blocked
}

func newFakeStore() *fakeStore {
	return &fakeStore{rows: map[[2]string]*Friendship{}, blocks: map[[2]string]bool{}}
}

func (f *fakeStore) Create(_ context.Context, req, addr string) error {
	f.rows[[2]string{req, addr}] = &Friendship{RequesterID: req, AddresseeID: addr, Status: "pending"}
	return nil
}
func (f *fakeStore) Find(_ context.Context, a, b string) (*Friendship, error) {
	if r, ok := f.rows[[2]string{a, b}]; ok {
		return r, nil
	}
	if r, ok := f.rows[[2]string{b, a}]; ok {
		return r, nil
	}
	return nil, errors.New("no rows")
}
func (f *fakeStore) UpdateStatus(_ context.Context, req, addr, status string) error {
	f.rows[[2]string{req, addr}].Status = status
	return nil
}
func (f *fakeStore) Delete(_ context.Context, a, b string) error {
	delete(f.rows, [2]string{a, b})
	delete(f.rows, [2]string{b, a})
	return nil
}
func (f *fakeStore) ListFriends(_ context.Context, id string) ([]user.User, error) {
	out := []user.User{}
	for k, r := range f.rows {
		if r.Status != "accepted" {
			continue
		}
		if k[0] == id {
			out = append(out, user.User{ID: k[1]})
		} else if k[1] == id {
			out = append(out, user.User{ID: k[0]})
		}
	}
	return out, nil
}
func (f *fakeStore) ListPending(context.Context, string) ([]PendingRequest, error) { return nil, nil }
func (f *fakeStore) ListSent(context.Context, string) ([]PendingRequest, error)    { return nil, nil }
func (f *fakeStore) Block(ctx context.Context, blocker, blocked string) error {
	f.Delete(ctx, blocker, blocked)
	f.blocks[[2]string{blocker, blocked}] = true
	return nil
}
func (f *fakeStore) Unblock(_ context.Context, blocker, blocked string) (bool, error) {
	k := [2]string{blocker, blocked}
	had := f.blocks[k]
	delete(f.blocks, k)
	return had, nil
}
func (f *fakeStore) Blocks(_ context.Context, a, b string) (bool, bool, error) {
	return f.blocks[[2]string{a, b}], f.blocks[[2]string{b, a}], nil
}
func (f *fakeStore) ListBlocked(context.Context, string) ([]user.User, error) { return nil, nil }
func (f *fakeStore) MutualFriends(ctx context.Context, a, b string) ([]user.User, error) {
	fa, _ := f.ListFriends(ctx, a)
	fb, _ := f.ListFriends(ctx, b)
	out := []user.User{}
	for _, x := range fa {
		for _, y := range fb {
			if x.ID == y.ID {
				out = append(out, x)
			}
		}
	}
	return out, nil
}

type fakeUsers map[string]*user.User

func (u fakeUsers) FindByID(_ context.Context, id string) (*user.User, error) {
	if x, ok := u[id]; ok {
		return x, nil
	}
	return nil, errors.New("not found")
}
func (u fakeUsers) FindByUsername(_ context.Context, name string) (*user.User, error) {
	for _, x := range u {
		if x.Username == name {
			return x, nil
		}
	}
	return nil, errors.New("not found")
}
func (u fakeUsers) FindByUsernameFold(_ context.Context, name string) (*user.User, error) {
	for _, x := range u {
		if strings.EqualFold(x.Username, name) {
			return x, nil
		}
	}
	return nil, errors.New("not found")
}

type fakeServers map[[2]string]bool

func (s fakeServers) SharesServer(_ context.Context, a, b string) (bool, error) {
	return s[[2]string{a, b}] || s[[2]string{b, a}], nil
}

// recorder anota os eventos publicados ("tipo:destinatário").
type recorder struct{ events []string }

func (r *recorder) add(kind, to string)                            { r.events = append(r.events, kind+":"+to) }
func (r *recorder) PublishFriendRequest(to string, _ *user.User)   { r.add("request", to) }
func (r *recorder) PublishFriendAccepted(to string, _ *user.User)  { r.add("accepted", to) }
func (r *recorder) PublishFriendDeclined(to string, _ *user.User)  { r.add("declined", to) }
func (r *recorder) PublishFriendCancelled(to string, _ *user.User) { r.add("cancelled", to) }
func (r *recorder) PublishFriendRemoved(to string, _ *user.User)   { r.add("removed", to) }
func (r *recorder) PublishUserBlocked(to string, _ *user.User)     { r.add("blocked", to) }
func (r *recorder) PublishUserUnblocked(to string, _ *user.User)   { r.add("unblocked", to) }

func (r *recorder) has(e string) bool {
	for _, x := range r.events {
		if x == e {
			return true
		}
	}
	return false
}

func setup() (*Service, *fakeStore, fakeUsers, *recorder) {
	users := fakeUsers{
		"a": {ID: "a", Username: "Ana", FriendRequestPolicy: user.FriendPolicyEveryone, AllowServerDMs: true},
		"b": {ID: "b", Username: "bia", FriendRequestPolicy: user.FriendPolicyEveryone, AllowServerDMs: true},
		"c": {ID: "c", Username: "caio", FriendRequestPolicy: user.FriendPolicyEveryone, AllowServerDMs: true},
	}
	st := newFakeStore()
	rec := &recorder{}
	return newService(st, users, rec), st, users, rec
}

func TestSendRequestCaseInsensitive(t *testing.T) {
	s, st, _, rec := setup()
	result, err := s.SendRequest(context.Background(), "b", "ANA")
	if err != nil || result != RequestSent {
		t.Fatalf("SendRequest = %q, %v", result, err)
	}
	if st.rows[[2]string{"b", "a"}] == nil || !rec.has("request:a") {
		t.Fatalf("pedido não criado/avisado: %v", rec.events)
	}
}

func TestSendRequestErrors(t *testing.T) {
	ctx := context.Background()
	s, _, _, _ := setup()
	if _, err := s.SendRequest(ctx, "a", "ninguem"); !errors.Is(err, ErrUserNotFound) {
		t.Errorf("usuário inexistente: %v", err)
	}
	if _, err := s.SendRequest(ctx, "a", "ana"); !errors.Is(err, ErrCannotAddSelf) {
		t.Errorf("a si mesmo: %v", err)
	}
	s.SendRequest(ctx, "a", "bia")
	if _, err := s.SendRequest(ctx, "a", "bia"); !errors.Is(err, ErrFriendshipExists) {
		t.Errorf("pedido repetido: %v", err)
	}
	s.AcceptRequest(ctx, "b", "Ana")
	if _, err := s.SendRequest(ctx, "a", "bia"); !errors.Is(err, ErrAlreadyFriends) {
		t.Errorf("já amigos: %v", err)
	}
}

func TestCrossRequestAutoAccepts(t *testing.T) {
	ctx := context.Background()
	s, st, _, rec := setup()
	s.SendRequest(ctx, "a", "bia")
	result, err := s.SendRequest(ctx, "b", "ana")
	if err != nil || result != RequestAccepted {
		t.Fatalf("pedido cruzado = %q, %v", result, err)
	}
	if st.rows[[2]string{"a", "b"}].Status != "accepted" {
		t.Fatal("pedido cruzado não virou amizade")
	}
	if !rec.has("accepted:a") {
		t.Errorf("quem pediu primeiro não foi avisado: %v", rec.events)
	}
}

func TestBlockedCannotRequest(t *testing.T) {
	ctx := context.Background()
	s, _, _, _ := setup()
	s.Block(ctx, "a", "b")
	// Quem foi bloqueado recebe a mesma resposta da privacidade.
	if _, err := s.SendRequest(ctx, "b", "ana"); !errors.Is(err, ErrRequestNotAllowed) {
		t.Errorf("bloqueado pediu amizade: %v", err)
	}
	if _, err := s.SendRequest(ctx, "a", "bia"); !errors.Is(err, ErrYouBlocked) {
		t.Errorf("quem bloqueou pediu amizade: %v", err)
	}
}

func TestBlockRemovesFriendship(t *testing.T) {
	ctx := context.Background()
	s, st, _, rec := setup()
	s.SendRequest(ctx, "a", "bia")
	s.AcceptRequest(ctx, "b", "Ana")
	if err := s.Block(ctx, "a", "b"); err != nil {
		t.Fatal(err)
	}
	if len(st.rows) != 0 {
		t.Fatal("bloqueio não desfez a amizade")
	}
	if !rec.has("removed:b") || !rec.has("blocked:a") {
		t.Errorf("eventos do bloqueio: %v", rec.events)
	}
	rel, _ := s.Relationship(ctx, "a", "b")
	if rel.Type != RelationBlocked {
		t.Errorf("relação de quem bloqueou = %q", rel.Type)
	}
	rel, _ = s.Relationship(ctx, "b", "a")
	if rel.Type != RelationNone {
		t.Errorf("bloqueado vê relação %q, want none", rel.Type)
	}
	if err := s.Unblock(ctx, "a", "b"); err != nil {
		t.Fatal(err)
	}
	if err := s.Unblock(ctx, "a", "b"); !errors.Is(err, ErrNotBlocked) {
		t.Errorf("desbloquear de novo: %v", err)
	}
}

func TestRequestPolicy(t *testing.T) {
	ctx := context.Background()
	s, _, users, _ := setup()
	servers := fakeServers{}
	s.SetServers(servers, nil)

	users["b"].FriendRequestPolicy = user.FriendPolicyNobody
	if _, err := s.SendRequest(ctx, "a", "bia"); !errors.Is(err, ErrRequestNotAllowed) {
		t.Errorf("política nobody: %v", err)
	}

	users["b"].FriendRequestPolicy = user.FriendPolicyMutualServers
	if _, err := s.SendRequest(ctx, "a", "bia"); !errors.Is(err, ErrRequestNotAllowed) {
		t.Errorf("sem servidor em comum: %v", err)
	}
	servers[[2]string{"a", "b"}] = true
	if _, err := s.SendRequest(ctx, "a", "bia"); err != nil {
		t.Errorf("com servidor em comum: %v", err)
	}

	// Amigos de amigos: c é amigo de a e de b.
	s2, st2, users2, _ := setup()
	users2["b"].FriendRequestPolicy = user.FriendPolicyMutualFriends
	if _, err := s2.SendRequest(ctx, "a", "bia"); !errors.Is(err, ErrRequestNotAllowed) {
		t.Errorf("sem amigo em comum: %v", err)
	}
	st2.rows[[2]string{"a", "c"}] = &Friendship{RequesterID: "a", AddresseeID: "c", Status: "accepted"}
	st2.rows[[2]string{"c", "b"}] = &Friendship{RequesterID: "c", AddresseeID: "b", Status: "accepted"}
	if _, err := s2.SendRequest(ctx, "a", "bia"); err != nil {
		t.Errorf("com amigo em comum: %v", err)
	}
}

func TestCanDirectMessage(t *testing.T) {
	ctx := context.Background()
	s, st, users, _ := setup()
	servers := fakeServers{}
	s.SetServers(servers, nil)

	if err := s.CanDirectMessage(ctx, "a", "b"); !errors.Is(err, ErrCannotMessage) {
		t.Errorf("estranhos: %v", err)
	}
	servers[[2]string{"a", "b"}] = true
	if err := s.CanDirectMessage(ctx, "a", "b"); err != nil {
		t.Errorf("servidor em comum: %v", err)
	}
	users["b"].AllowServerDMs = false
	if err := s.CanDirectMessage(ctx, "a", "b"); !errors.Is(err, ErrCannotMessage) {
		t.Errorf("DM de servidor desligada: %v", err)
	}
	st.rows[[2]string{"a", "b"}] = &Friendship{RequesterID: "a", AddresseeID: "b", Status: "accepted"}
	if err := s.CanDirectMessage(ctx, "a", "b"); err != nil {
		t.Errorf("amigos: %v", err)
	}
	st.blocks[[2]string{"b", "a"}] = true
	if err := s.CanDirectMessage(ctx, "a", "b"); !errors.Is(err, ErrBlocked) {
		t.Errorf("bloqueado: %v", err)
	}
}
