package message

import (
	"context"
	"os"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/platform/database"

	"github.com/google/uuid"
)

// O canal de voz alvo da TTS (issue #384) vai e volta pelo Postgres de verdade
// (TEST_DATABASE_URL, banco descartável), e some (NULL) se o canal é apagado.
func TestTTSVoiceChannelRoundTripDB(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	ctx := context.Background()
	db, err := database.Connect(dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}

	suffix := strings.ReplaceAll(uuid.NewString(), "-", "")[:8]
	user, serverID, textID, voiceID := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec(`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, user, "ana"+suffix)
	exec(`INSERT INTO servers (id, name, owner_id) VALUES ($1, 'tts', $2)`, serverID, user)
	exec(`INSERT INTO channels (id, server_id, name, type, created_by) VALUES ($1, $2, 'geral', 'text', $3), ($4, $2, 'sala', 'voice', $3)`, textID, serverID, user, voiceID)
	t.Cleanup(func() {
		db.Exec(ctx, `DELETE FROM servers WHERE id = $1`, serverID)
		db.Exec(ctx, `DELETE FROM users WHERE id = $1`, user)
	})

	repo := MessageRepository(db)
	msg := &Message{ID: uuid.NewString(), AuthorID: user, ChannelID: &textID, Content: "oi", TTS: true, TTSVoiceChannelID: &voiceID}
	if err := repo.Create(ctx, msg); err != nil {
		t.Fatal(err)
	}
	got, err := repo.FindByID(ctx, msg.ID)
	if err != nil || got.TTSVoiceChannelID == nil || *got.TTSVoiceChannelID != voiceID {
		t.Fatalf("alvo = %v, err = %v; want %s", got, err, voiceID)
	}

	exec(`DELETE FROM channels WHERE id = $1`, voiceID)
	got, err = repo.FindByID(ctx, msg.ID)
	if err != nil || got.TTSVoiceChannelID != nil {
		t.Fatalf("canal apagado: alvo = %v, err = %v; want nil", got.TTSVoiceChannelID, err)
	}
}
