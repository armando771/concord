package badge

import (
	"context"
	"os"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/platform/database"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// openTestDB abre o Postgres descartável (TEST_DATABASE_URL) com as
// migrations aplicadas; sem ele, o teste é pulado.
func openTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	db, err := database.Connect(url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	return db
}

// newTestUser cria um usuário que some no fim do teste.
func newTestUser(t *testing.T, db *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	id := uuid.NewString()
	name := "b" + strings.ReplaceAll(id, "-", "")[:12]
	if _, err := db.Exec(ctx, `INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, id, name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id) })
	return id
}

func TestRepositoryCountsAcceptedFriends(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	me, ana, bia, caio := newTestUser(t, db), newTestUser(t, db), newTestUser(t, db), newTestUser(t, db)
	// Amizade conta dos dois lados do pedido; pedido pendente não conta.
	for _, f := range [][3]string{{me, ana, "accepted"}, {bia, me, "accepted"}, {me, caio, "pending"}} {
		if _, err := db.Exec(ctx, `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, $3)`, f[0], f[1], f[2]); err != nil {
			t.Fatal(err)
		}
	}
	s, err := BadgeRepository(db).Stats(ctx, me)
	if err != nil {
		t.Fatal(err)
	}
	if s.Friends != 2 {
		t.Fatalf("friends = %d, want 2 (pendente não conta)", s.Friends)
	}
}

func TestRepositoryReadsBugHunters(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	me := newTestUser(t, db)
	// O SQL de docs/HOSPEDAGEM.md: conceder e somar pelo username.
	var name string
	if err := db.QueryRow(ctx, `SELECT username FROM users WHERE id = $1`, me).Scan(&name); err != nil {
		t.Fatal(err)
	}
	grant := `INSERT INTO bug_hunters (user_id, bugs) SELECT id, $2 FROM users WHERE lower(username) = lower($1)
		ON CONFLICT (user_id) DO UPDATE SET bugs = bug_hunters.bugs + EXCLUDED.bugs, updated_at = NOW()`
	for _, n := range []int{1, 2} {
		if _, err := db.Exec(ctx, grant, strings.ToUpper(name), n); err != nil {
			t.Fatal(err)
		}
	}
	s, err := BadgeRepository(db).Stats(ctx, me)
	if err != nil {
		t.Fatal(err)
	}
	if s.BugsReported != 3 {
		t.Fatalf("bugs = %d, want 3", s.BugsReported)
	}
}
