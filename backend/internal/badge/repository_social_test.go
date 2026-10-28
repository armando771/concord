package badge

import (
	"context"
	"os"
	"strings"
	"sync"
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
	// Os amigos são contas reais (amigos_test.go testa as que não são).
	if _, err := db.Exec(ctx, `UPDATE users SET email_verified_at = NOW() - INTERVAL '30 days', created_at = NOW() - INTERVAL '30 days' WHERE id = ANY($1)`, []string{ana, bia, caio}); err != nil {
		t.Fatal(err)
	}
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

// O Top 10 é uma tabela só para o app inteiro: o teste esvazia a fila (o
// banco de teste é descartável).
func TestRepositoryClaimTop10IsRaceSafe(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	reset := func() {
		if _, err := db.Exec(ctx, `DELETE FROM badge_top10`); err != nil {
			t.Fatal(err)
		}
	}
	reset()
	t.Cleanup(reset)
	repo := BadgeRepository(db)

	users := make([]string, 15)
	for i := range users {
		users[i] = newTestUser(t, db)
	}
	ranks := make([]int64, len(users))
	var wg sync.WaitGroup
	for i, id := range users {
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			r, err := repo.ClaimTop10(ctx, id)
			if err != nil {
				t.Error(err)
			}
			ranks[i] = r
		}(i, id)
	}
	wg.Wait()

	seen := map[int64]bool{}
	for _, r := range ranks {
		if r == 0 {
			continue
		}
		if r < 1 || r > Top10Slots || seen[r] {
			t.Fatalf("posições = %v, want 1..10 sem repetir", ranks)
		}
		seen[r] = true
	}
	if len(seen) != Top10Slots {
		t.Fatalf("%d vagas preenchidas, want %d: %v", len(seen), Top10Slots, ranks)
	}
	// Pedir de novo devolve a mesma posição; quem ficou de fora continua fora.
	for i, id := range users {
		again, err := repo.ClaimTop10(ctx, id)
		if err != nil || again != ranks[i] {
			t.Fatalf("de novo %s = %d (%v), want %d", id, again, err, ranks[i])
		}
	}
	s, err := repo.Stats(ctx, users[0])
	if err != nil || s.Top10Rank != ranks[0] {
		t.Fatalf("Stats.Top10Rank = %d (%v), want %d", s.Top10Rank, err, ranks[0])
	}
}
