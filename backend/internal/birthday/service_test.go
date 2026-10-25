package birthday

import (
	"context"
	"errors"
	"testing"
	"time"

	"gin-quickstart/backend/internal/message"
)

type fakeStore struct {
	targets  []target
	claimed  map[string]bool
	messages map[string]string
	released []string
}

func newFakeStore(targets ...target) *fakeStore {
	return &fakeStore{targets: targets, claimed: map[string]bool{}, messages: map[string]string{}}
}

func (f *fakeStore) Targets(_ context.Context, _ int, _ []int) ([]target, error) {
	return f.targets, nil
}

func (f *fakeStore) Claim(_ context.Context, serverID string, day time.Time, _ string) (bool, error) {
	key := serverID + day.Format(time.DateOnly)
	if f.claimed[key] {
		return false, nil
	}
	f.claimed[key] = true
	return true, nil
}

func (f *fakeStore) SetMessage(_ context.Context, serverID string, _ time.Time, messageID string) error {
	f.messages[serverID] = messageID
	return nil
}

func (f *fakeStore) Release(_ context.Context, serverID string, day time.Time) error {
	delete(f.claimed, serverID+day.Format(time.DateOnly))
	f.released = append(f.released, serverID)
	return nil
}

type fakePoster struct {
	posts []string // "<canal>|<texto>"
	fail  bool
}

func (f *fakePoster) CreateSystemChannelMessage(_ context.Context, channelID string, _ string, content string, kind string) (*message.Message, error) {
	if f.fail {
		return nil, errors.New("falhou")
	}
	if kind != SystemKind {
		return nil, errors.New("kind errado")
	}
	f.posts = append(f.posts, channelID+"|"+content)
	return &message.Message{ID: "msg-" + channelID}, nil
}

func str(s string) *string { return &s }

func newTestService(store *fakeStore, poster *fakePoster) *Service {
	return &Service{store: store, poster: poster, location: time.FixedZone("BRT", -3*60*60)}
}

// brt: horário de Brasília em 25/10/2026.
func brt(hour, minute int) time.Time {
	return time.Date(2026, 10, 25, hour, minute, 0, 0, time.FixedZone("BRT", -3*60*60))
}

func TestAnnouncesAtNineOncePerServer(t *testing.T) {
	store := newFakeStore(
		target{ServerID: "s1", ServerName: "Galera", ChannelID: str("geral"), Usernames: []string{"ana", "bia"}},
		target{ServerID: "s2", ServerName: "Amigos", ChannelID: str("chat"), Usernames: []string{"ana"}},
	)
	poster := &fakePoster{}
	s := newTestService(store, poster)

	s.tick(context.Background(), brt(8, 59))
	if len(poster.posts) != 0 {
		t.Fatalf("before 9h: %v", poster.posts)
	}

	s.tick(context.Background(), brt(9, 0))
	want := []string{
		"geral|🎂 O servidor Galera deseja um feliz aniversário para @ana e @bia! Muitas felicidades e ótimas calls! 🎉",
		"chat|🎂 O servidor Amigos deseja um feliz aniversário para @ana! Muitas felicidades e ótimas calls! 🎉",
	}
	if len(poster.posts) != 2 || poster.posts[0] != want[0] || poster.posts[1] != want[1] {
		t.Fatalf("posts = %q", poster.posts)
	}
	if store.messages["s1"] != "msg-geral" {
		t.Fatalf("message id not stored: %v", store.messages)
	}

	// Mais tarde no mesmo dia (ou outra instância que reiniciou): não repete.
	s.tick(context.Background(), brt(15, 0))
	s2 := newTestService(store, poster)
	s2.tick(context.Background(), brt(16, 0))
	if len(poster.posts) != 2 {
		t.Fatalf("repeated on the same day: %v", poster.posts)
	}
}

func TestFailedPostIsRetried(t *testing.T) {
	store := newFakeStore(target{ServerID: "s1", ServerName: "Galera", ChannelID: str("geral"), Usernames: []string{"ana"}})
	poster := &fakePoster{fail: true}
	s := newTestService(store, poster)

	s.tick(context.Background(), brt(9, 0))
	if len(store.released) != 1 {
		t.Fatalf("failed post must release the claim, released = %v", store.released)
	}

	poster.fail = false
	s.tick(context.Background(), brt(9, 1))
	if len(poster.posts) != 1 {
		t.Fatalf("retry posts = %v", poster.posts)
	}
}

func TestServerWithoutTextChannelIsSkipped(t *testing.T) {
	store := newFakeStore(target{ServerID: "s1", ServerName: "Só voz", ChannelID: nil, Usernames: []string{"ana"}})
	poster := &fakePoster{}
	newTestService(store, poster).tick(context.Background(), brt(9, 0))
	if len(poster.posts) != 0 {
		t.Fatalf("posted without a text channel: %v", poster.posts)
	}
}
