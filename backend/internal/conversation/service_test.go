package conversation

import (
	"context"
	"errors"
	"sort"
	"testing"
)

type member struct {
	hidden bool
	read   bool
}

// fakeStore guarda conversas e participantes em memória (ordem de entrada).
type fakeStore struct {
	convs   map[string]*Conversation
	members map[string][]string   // conversa → ids na ordem de entrada
	state   map[[2]string]*member // conversa, usuário
	list    []Summary             // o que ListByUserID devolve
}

func newFakeStore() *fakeStore {
	return &fakeStore{convs: map[string]*Conversation{}, members: map[string][]string{}, state: map[[2]string]*member{}}
}

func (f *fakeStore) add(id string, users ...string) {
	for _, u := range users {
		f.members[id] = append(f.members[id], u)
		f.state[[2]string{id, u}] = &member{}
	}
}

func (f *fakeStore) CreateDM(_ context.Context, c *Conversation, opener string) error {
	f.convs[c.ID] = c
	f.add(c.ID, c.UserAID, c.UserBID)
	f.state[[2]string{c.ID, c.UserAID}].hidden = c.UserAID != opener
	f.state[[2]string{c.ID, c.UserBID}].hidden = c.UserBID != opener
	return nil
}
func (f *fakeStore) CreateGroup(_ context.Context, c *Conversation, ids []string) error {
	f.convs[c.ID] = c
	f.add(c.ID, ids...)
	return nil
}
func (f *fakeStore) FindByPair(_ context.Context, a, b string) (*Conversation, error) {
	for _, c := range f.convs {
		if c.Type == TypeDM && c.UserAID == a && c.UserBID == b {
			return c, nil
		}
	}
	return nil, errors.New("no rows")
}
func (f *fakeStore) FindByID(_ context.Context, id string) (*Conversation, error) {
	if c, ok := f.convs[id]; ok {
		return c, nil
	}
	return nil, errors.New("no rows")
}
func (f *fakeStore) IsMember(_ context.Context, id, u string) (bool, error) {
	_, ok := f.state[[2]string{id, u}]
	return ok, nil
}
func (f *fakeStore) ConversationParticipantIDs(_ context.Context, id string) ([]string, error) {
	return append([]string{}, f.members[id]...), nil
}
func (f *fakeStore) Members(_ context.Context, id string) ([]OtherUser, error) {
	out := []OtherUser{}
	for _, u := range f.members[id] {
		out = append(out, OtherUser{ID: u})
	}
	return out, nil
}
func (f *fakeStore) SetHidden(_ context.Context, id, u string, h bool) error {
	f.state[[2]string{id, u}].hidden = h
	return nil
}
func (f *fakeStore) MarkRead(_ context.Context, id, u, _ string) error {
	f.state[[2]string{id, u}].read = true
	return nil
}
func (f *fakeStore) Rename(_ context.Context, id, name string) error {
	f.convs[id].Name = name
	return nil
}
func (f *fakeStore) SetIcon(_ context.Context, id string, url *string) (*string, error) {
	old := f.convs[id].IconURL
	f.convs[id].IconURL = url
	return old, nil
}
func (f *fakeStore) AddMembers(_ context.Context, id string, ids []string) error {
	f.add(id, ids...)
	return nil
}
func (f *fakeStore) RemoveMember(_ context.Context, id, u string) error {
	delete(f.state, [2]string{id, u})
	kept := []string{}
	for _, x := range f.members[id] {
		if x != u {
			kept = append(kept, x)
		}
	}
	f.members[id] = kept
	return nil
}
func (f *fakeStore) SetOwner(_ context.Context, id, owner string) error {
	f.convs[id].OwnerID = &owner
	return nil
}
func (f *fakeStore) Delete(_ context.Context, id string) error {
	delete(f.convs, id)
	return nil
}
func (f *fakeStore) ListByUserID(context.Context, string) ([]Summary, error) { return f.list, nil }

// fakeFriends: amizades e bloqueios por par (ordem não importa).
type fakeFriends struct {
	friends map[string]bool
	blocked map[string]bool
	dmErr   error
}

func pair(a, b string) string {
	p := []string{a, b}
	sort.Strings(p)
	return p[0] + "|" + p[1]
}

func (f *fakeFriends) AreFriends(_ context.Context, a, b string) (bool, error) {
	return f.friends[pair(a, b)], nil
}
func (f *fakeFriends) IsBlockedEither(_ context.Context, a, b string) (bool, error) {
	return f.blocked[pair(a, b)], nil
}
func (f *fakeFriends) CanDirectMessage(context.Context, string, string) error { return f.dmErr }

type recorder struct{ events []string }

func (r *recorder) PublishConversationEvent(kind, _ string, ids []string) {
	for _, id := range ids {
		r.events = append(r.events, kind+":"+id)
	}
}

func (r *recorder) has(e string) bool {
	for _, x := range r.events {
		if x == e {
			return true
		}
	}
	return false
}

func setup() (*Service, *fakeStore, *fakeFriends, *recorder) {
	st := newFakeStore()
	fr := &fakeFriends{friends: map[string]bool{}, blocked: map[string]bool{}}
	rec := &recorder{}
	s := &Service{repository: st}
	s.SetDependencies(fr, rec)
	return s, st, fr, rec
}

func TestDMVisibleOnlyToOpener(t *testing.T) {
	ctx := context.Background()
	s, st, _, _ := setup()
	conv, err := s.GetOrCreateWith(ctx, "b", "a")
	if err != nil {
		t.Fatal(err)
	}
	if conv.UserAID != "a" || conv.UserBID != "b" {
		t.Fatalf("par fora de ordem: %+v", conv)
	}
	if st.state[[2]string{conv.ID, "b"}].hidden || !st.state[[2]string{conv.ID, "a"}].hidden {
		t.Error("DM nova deve aparecer só para quem abriu")
	}

	again, _ := s.GetOrCreateWith(ctx, "a", "b")
	if again.ID != conv.ID || st.state[[2]string{conv.ID, "a"}].hidden {
		t.Error("abrir de novo deve reusar e reabrir a DM")
	}
}

func TestCreateDMRespectsPermission(t *testing.T) {
	s, _, fr, _ := setup()
	fr.dmErr = errors.New("nope")
	if _, err := s.GetOrCreateWith(context.Background(), "a", "b"); err == nil {
		t.Fatal("criou DM sem permissão")
	}
}

func TestHideAndRead(t *testing.T) {
	ctx := context.Background()
	s, st, _, rec := setup()
	conv, _ := s.GetOrCreateWith(ctx, "a", "b")
	if err := s.Hide(ctx, "a", conv.ID); err != nil {
		t.Fatal(err)
	}
	if !st.state[[2]string{conv.ID, "a"}].hidden || !rec.has(EventRemove+":a") {
		t.Error("fechar a DM não escondeu/avisou")
	}
	if err := s.Hide(ctx, "c", conv.ID); !errors.Is(err, ErrNotParticipant) {
		t.Errorf("estranho fechou a DM: %v", err)
	}
	if err := s.MarkRead(ctx, "b", conv.ID, ""); err != nil || !st.state[[2]string{conv.ID, "b"}].read {
		t.Errorf("marcar como lido: %v", err)
	}
	if !rec.has(EventRead + ":b") {
		t.Error("lido não sincronizou")
	}
}

func TestCreateGroup(t *testing.T) {
	ctx := context.Background()
	s, st, fr, rec := setup()

	if _, err := s.CreateGroup(ctx, "a", []string{"b", "c"}); !errors.Is(err, ErrOnlyFriends) {
		t.Fatalf("grupo com não amigos: %v", err)
	}
	fr.friends[pair("a", "b")] = true
	fr.friends[pair("a", "c")] = true

	conv, err := s.CreateGroup(ctx, "a", []string{"b", "c", "b", "a"})
	if err != nil {
		t.Fatal(err)
	}
	if !conv.IsGroup() || *conv.OwnerID != "a" {
		t.Fatalf("grupo: %+v", conv)
	}
	if got := st.members[conv.ID]; len(got) != 3 {
		t.Errorf("participantes = %v", got)
	}
	for _, u := range []string{"a", "b", "c"} {
		if !rec.has(EventCreate + ":" + u) {
			t.Errorf("%s não soube do grupo", u)
		}
	}

	// Um amigo só: vira a DM 1:1.
	dm, err := s.CreateGroup(ctx, "a", []string{"b"})
	if err != nil || dm.IsGroup() {
		t.Errorf("um amigo deve abrir DM: %+v %v", dm, err)
	}

	many := []string{}
	for i := 0; i < MaxGroupMembers; i++ {
		id := string(rune('d' + i))
		fr.friends[pair("a", id)] = true
		many = append(many, id)
	}
	if _, err := s.CreateGroup(ctx, "a", many); !errors.Is(err, ErrGroupFull) {
		t.Errorf("grupo acima do limite: %v", err)
	}

	fr.blocked[pair("a", "c")] = true
	if _, err := s.CreateGroup(ctx, "a", []string{"b", "c"}); !errors.Is(err, ErrOnlyFriends) {
		t.Errorf("grupo com bloqueado: %v", err)
	}
}

func TestGroupMembership(t *testing.T) {
	ctx := context.Background()
	s, st, fr, rec := setup()
	for _, u := range []string{"b", "c", "d"} {
		fr.friends[pair("a", u)] = true
	}
	conv, _ := s.CreateGroup(ctx, "a", []string{"b", "c"})

	if err := s.Rename(ctx, "b", conv.ID, "  Galera  "); err != nil || st.convs[conv.ID].Name != "Galera" {
		t.Errorf("renomear: %v %q", err, st.convs[conv.ID].Name)
	}
	if err := s.Rename(ctx, "x", conv.ID, "x"); !errors.Is(err, ErrNotParticipant) {
		t.Errorf("estranho renomeou: %v", err)
	}

	if err := s.AddMembers(ctx, "a", conv.ID, []string{"d"}); err != nil {
		t.Fatal(err)
	}
	if !rec.has(EventCreate + ":d") {
		t.Error("quem entrou não soube do grupo")
	}

	if err := s.RemoveMember(ctx, "b", conv.ID, "c"); !errors.Is(err, ErrNotOwner) {
		t.Errorf("não dono removeu alguém: %v", err)
	}
	if err := s.RemoveMember(ctx, "a", conv.ID, "c"); err != nil {
		t.Fatal(err)
	}
	if !rec.has(EventRemove + ":c") {
		t.Error("removido não foi avisado")
	}

	// Dono sai: o mais antigo que sobrou vira dono.
	if err := s.RemoveMember(ctx, "a", conv.ID, "a"); err != nil {
		t.Fatal(err)
	}
	if owner := st.convs[conv.ID].OwnerID; owner == nil || *owner != "b" {
		t.Errorf("novo dono = %v, want b", owner)
	}

	// Todo mundo sai: grupo apagado.
	s.RemoveMember(ctx, "b", conv.ID, "b")
	s.RemoveMember(ctx, "d", conv.ID, "d")
	if _, ok := st.convs[conv.ID]; ok {
		t.Error("grupo vazio não foi apagado")
	}
}

func TestGroupCannotBeHidden(t *testing.T) {
	ctx := context.Background()
	s, _, fr, _ := setup()
	fr.friends[pair("a", "b")] = true
	fr.friends[pair("a", "c")] = true
	conv, _ := s.CreateGroup(ctx, "a", []string{"b", "c"})
	if err := s.Hide(ctx, "a", conv.ID); !errors.Is(err, ErrIsGroup) {
		t.Errorf("fechou grupo: %v", err)
	}
}
