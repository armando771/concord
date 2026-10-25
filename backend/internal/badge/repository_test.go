package badge

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/database"

	"github.com/google/uuid"
)

// Contadores por trigger e gravação do tracker num Postgres de verdade
// (TEST_DATABASE_URL, banco descartável).
func TestRepositoryDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	ctx := context.Background()
	db, err := database.Connect(url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}

	userID, serverID, channelID := uuid.NewString(), uuid.NewString(), uuid.NewString()
	name := "b" + strings.ReplaceAll(userID, "-", "")[:12]
	exec(`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, userID, name)
	t.Cleanup(func() {
		db.Exec(ctx, `DELETE FROM servers WHERE id = $1`, serverID)
		db.Exec(ctx, `DELETE FROM messages WHERE author_id = $1`, userID)
		db.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	})
	exec(`INSERT INTO servers (id, name, owner_id) VALUES ($1, 'b', $2)`, serverID, userID)
	exec(`INSERT INTO channels (id, server_id, name, created_by) VALUES ($1, $2, 'geral', $3)`, channelID, serverID, userID)

	msgs := []string{uuid.NewString(), uuid.NewString(), uuid.NewString()}
	for _, id := range msgs {
		exec(`INSERT INTO messages (id, author_id, channel_id, content) VALUES ($1, $2, $3, 'oi')`, id, userID, channelID)
	}
	// Mensagem de sistema não conta.
	exec(`INSERT INTO messages (id, author_id, channel_id, content, system_kind) VALUES ($1, $2, $3, 'parabéns', 'birthday')`, uuid.NewString(), userID, channelID)
	// Apagar não desconta.
	exec(`DELETE FROM messages WHERE id = $1`, msgs[2])

	exec(`INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, '👍'), ($1, $2, '🔥'), ($3, $2, '👍')`, msgs[0], userID, msgs[1])
	exec(`DELETE FROM message_reactions WHERE message_id = $1 AND emoji = '🔥'`, msgs[0])

	repo := BadgeRepository(db)
	if err := repo.AddCallStats(ctx, userID, Delta{Stream: 30, Night: 10, PeakCallSize: 6, LongestSession: 100}); err != nil {
		t.Fatal(err)
	}
	if err := repo.AddCallStats(ctx, userID, Delta{Stream: 30, Morning: 5, PeakCallSize: 4, LongestSession: 50}); err != nil {
		t.Fatal(err)
	}

	s, err := repo.Stats(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if s.MessagesSent != 3 || s.Reactions != 2 || s.OwnedServers != 1 {
		t.Fatalf("counters = msgs %d reactions %d servers %d, want 3/2/1", s.MessagesSent, s.Reactions, s.OwnedServers)
	}
	if s.StreamSeconds != 60 || s.NightSeconds != 10 || s.MorningSeconds != 5 || s.PeakCallSize != 6 || s.LongestSessionSeconds != 100 {
		t.Fatalf("call stats = %+v", s)
	}

	at := time.Now().Add(-time.Hour).UTC().Truncate(time.Microsecond)
	saved, err := repo.SaveUnlocks(ctx, userID, []Unlock{{"dono", 1, at}, {"fundador", 1, at}})
	if err != nil || len(saved) != 2 {
		t.Fatalf("first save = %+v, %v", saved, err)
	}
	saved, err = repo.SaveUnlocks(ctx, userID, []Unlock{{"dono", 1, time.Now()}, {"festeiro", 1, at}})
	if err != nil || len(saved) != 1 || saved[0].Category != "festeiro" {
		t.Fatalf("second save = %+v, %v (dono was already there)", saved, err)
	}
	unlocks, err := repo.Unlocks(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if got := unlocks["dono"][1]; !got.Equal(at) {
		t.Fatalf("dono unlocked_at = %v, want the first one %v", got, at)
	}

	if _, err := repo.Stats(ctx, uuid.NewString()); err != ErrUserNotFound {
		t.Fatalf("unknown user err = %v", err)
	}
}
