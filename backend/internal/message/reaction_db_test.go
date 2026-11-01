package message

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/platform/database"

	"github.com/google/uuid"
)

// Limite de reações diferentes num Postgres de verdade (TEST_DATABASE_URL,
// banco descartável): a 21ª reação diferente é recusada, repetir um emoji que
// já está continua valendo e tirar uma libera a vaga.
func TestAddReactionLimitDB(t *testing.T) {
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
	ana, bia := uuid.NewString(), uuid.NewString()
	for name, id := range map[string]string{"ana": ana, "bia": bia} {
		exec(`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`,
			id, name+suffix)
	}
	pair := []string{ana, bia}
	sort.Strings(pair)
	convID, msgID := uuid.NewString(), uuid.NewString()
	exec(`INSERT INTO conversations (id, user_a_id, user_b_id) VALUES ($1, $2, $3)`, convID, pair[0], pair[1])
	exec(`INSERT INTO messages (id, author_id, conversation_id, content) VALUES ($1, $2, $3, 'oi')`, msgID, ana, convID)
	t.Cleanup(func() {
		db.Exec(ctx, `DELETE FROM messages WHERE id = $1`, msgID)
		db.Exec(ctx, `DELETE FROM conversations WHERE id = $1`, convID)
		db.Exec(ctx, `DELETE FROM users WHERE id = ANY($1)`, []string{ana, bia})
	})

	repo := MessageRepository(db)
	for i := 0; i < MaxDistinctReactions; i++ {
		if added, err := repo.AddReaction(ctx, msgID, ana, fmt.Sprintf("e%d", i)); err != nil || !added {
			t.Fatalf("reação %d: added=%v err=%v", i+1, added, err)
		}
	}

	if _, err := repo.AddReaction(ctx, msgID, ana, "nova"); !errors.Is(err, ErrTooManyReactions) {
		t.Fatalf("21ª reação diferente: quero ErrTooManyReactions, veio %v", err)
	}
	if added, err := repo.AddReaction(ctx, msgID, bia, "e3"); err != nil || !added {
		t.Fatalf("emoji que já está: added=%v err=%v", added, err)
	}
	if added, err := repo.AddReaction(ctx, msgID, ana, "e3"); err != nil || added {
		t.Fatalf("a mesma reação de novo: added=%v err=%v (quero false, nil)", added, err)
	}

	if _, err := repo.RemoveReaction(ctx, msgID, ana, "e0"); err != nil {
		t.Fatal(err)
	}
	if added, err := repo.AddReaction(ctx, msgID, ana, "nova"); err != nil || !added {
		t.Fatalf("depois de liberar uma vaga: added=%v err=%v", added, err)
	}
}
