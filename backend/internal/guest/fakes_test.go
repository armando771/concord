package guest

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"gin-quickstart/backend/internal/call"
	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/permission"
)

// memStore: o banco dos convites em memória.
type memStore struct {
	mu      sync.Mutex
	invites map[string]*Invite // id -> convite
	hashes  map[string]string  // hash -> id
	passes  map[string]*Pass   // id -> acesso
	users   map[string]GuestUser
	deleted int
}

func newMemStore() *memStore {
	return &memStore{invites: map[string]*Invite{}, hashes: map[string]string{}, passes: map[string]*Pass{}, users: map[string]GuestUser{}}
}

func (m *memStore) CreateInvite(_ context.Context, inv *Invite, hash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	c := *inv
	m.invites[inv.ID] = &c
	m.hashes[hash] = inv.ID
	return nil
}

func (m *memStore) InviteByHash(_ context.Context, hash string) (*Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[m.hashes[hash]]
	if !ok {
		return nil, ErrNotFound
	}
	c := *inv
	return &c, nil
}

func (m *memStore) InviteByID(_ context.Context, id string) (*Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, ErrNotFound
	}
	c := *inv
	return &c, nil
}

func (m *memStore) InvitesOfChannel(_ context.Context, channelID string, now time.Time) ([]Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []Invite{}
	for _, inv := range m.invites {
		if inv.ChannelID == channelID && inv.usable(now) {
			out = append(out, *inv)
		}
	}
	return out, nil
}

func (m *memStore) GuestsOf(_ context.Context, ids []string) ([]InviteGuest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []InviteGuest{}
	for _, p := range m.passes {
		for _, id := range ids {
			if p.InviteID == id {
				out = append(out, InviteGuest{InviteID: id, UserID: p.UserID, DisplayName: m.users[p.UserID].DisplayName, EndedAt: p.EndedAt})
			}
		}
	}
	return out, nil
}

func (m *memStore) RevokeInvite(_ context.Context, id string, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.invites[id].RevokedAt = &now
	return nil
}

func (m *memStore) CreateGuestUser(_ context.Context, u GuestUser) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.users[u.ID] = u
	return nil
}

func (m *memStore) CreatePass(_ context.Context, p *Pass) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	c := *p
	m.passes[p.ID] = &c
	return nil
}

func (m *memStore) PassFor(_ context.Context, inviteID, userID string) (*Pass, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, p := range m.passes {
		if p.InviteID == inviteID && p.UserID == userID {
			c := *p
			return &c, nil
		}
	}
	return nil, ErrNotFound
}

func (m *memStore) CountPasses(_ context.Context, inviteID string) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for _, p := range m.passes {
		if p.InviteID == inviteID {
			n++
		}
	}
	return n, nil
}

func (m *memStore) MovePass(_ context.Context, id, channelID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.passes[id].ChannelID = channelID
	return nil
}

func (m *memStore) EndPass(_ context.Context, id string, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.passes[id].EndedAt = &now
	return nil
}

func (m *memStore) ActivePasses(_ context.Context, now time.Time) ([]Pass, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []Pass{}
	for _, p := range m.passes {
		inv := m.invites[p.InviteID]
		if p.EndedAt == nil && inv.usable(now) {
			out = append(out, *p)
		}
	}
	return out, nil
}

func (m *memStore) DeleteStaleGuests(context.Context, time.Time) (int64, error) {
	m.deleted++
	return 0, nil
}

// fakeDir: um servidor "srv" com os canais de voz "sala" e "outra" e o texto "geral".
type fakeDir struct{ banned map[string]bool }

func (fakeDir) Channel(_ context.Context, id string) (*channel.Channel, error) {
	types := map[string]string{"sala": channel.TypeVoice, "outra": channel.TypeVoice, "geral": channel.TypeText}
	t, ok := types[id]
	if !ok {
		return nil, errors.New("canal não existe")
	}
	return &channel.Channel{ID: id, ServerID: "srv", Name: strings.ToUpper(id[:1]) + id[1:], Type: t}, nil
}
func (fakeDir) Server(context.Context, string) ServerInfo {
	return ServerInfo{Name: "Salinha", IconURL: "https://cdn/icone.png"}
}
func (fakeDir) DisplayName(_ context.Context, id string) string {
	return "Nome de " + id
}
func (d fakeDir) IsBanned(_ context.Context, _, userID string) bool { return d.banned[userID] }

// fakeCalls: quem está em qual canal de voz e quem foi tirado.
type fakeCalls struct {
	in      map[string]string
	removed []string
}

func (f *fakeCalls) VoiceLocationOf(userID string) (call.VoiceLocation, bool) {
	ch, ok := f.in[userID]
	return call.VoiceLocation{CallID: "call-" + ch, ChannelID: ch, ServerID: "srv"}, ok
}

func (f *fakeCalls) RemoveFromServerCalls(_ context.Context, serverID, userID string) {
	f.removed = append(f.removed, serverID+"|"+userID)
	delete(f.in, userID)
}

type fakeNotifier struct{ sent map[string][]string }

func (f *fakeNotifier) SendToUser(userID string, event []byte) {
	f.sent[userID] = append(f.sent[userID], string(event))
}

type fakeTokens struct{}

func (fakeTokens) GenerateGuestToken(userID string, until time.Time) (string, error) {
	return "sessao:" + userID + ":" + until.Format(time.RFC3339), nil
}

// world: o servidor "srv" (dono "dono"; "mod" com cargo que convida; "ana"
// membro comum), com dono e mod na call da "sala".
type world struct {
	svc    *Service
	store  *memStore
	calls  *fakeCalls
	notify *fakeNotifier
	now    time.Time
}

func newWorld() *world {
	snap := permission.NewSnapshot("srv", "dono", permission.DefaultEveryone).
		WithRole("mod", 1, permission.InviteGuests).
		WithRole("seg", 2, permission.DisconnectMembers).
		WithMember("dono").
		WithMember("mod", "mod").
		WithMember("seg", "seg").
		WithMember("ana").
		WithChannel("sala", permission.ChannelVoice).
		WithChannel("outra", permission.ChannelVoice).
		WithChannel("geral", permission.ChannelText)
	perms := permission.NewService(&permission.StaticStore{Snapshots: map[string]*permission.Snapshot{"srv": snap}})
	w := &world{
		store:  newMemStore(),
		calls:  &fakeCalls{in: map[string]string{"dono": "sala", "mod": "sala", "ana": "sala", "seg": "sala"}},
		notify: &fakeNotifier{sent: map[string][]string{}},
		now:    time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC),
	}
	w.svc = NewService(w.store, perms, fakeDir{banned: map[string]bool{"banido": true}}, w.calls, w.notify, fakeTokens{})
	w.svc.now = func() time.Time { return w.now }
	return w
}

// invite: o mod gera um link de 2h na sala, podendo falar.
func (w *world) invite() *CreatedInvite {
	inv, err := w.svc.CreateInvite(context.Background(), "mod", CreateInput{ChannelID: "sala", Duration: "2h", CanSpeak: true})
	if err != nil {
		panic(err)
	}
	return inv
}
