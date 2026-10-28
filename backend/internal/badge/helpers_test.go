package badge

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// category devolve a categoria do catálogo (falha se não existir).
func category(t *testing.T, key string) Category {
	t.Helper()
	for _, c := range Catalog {
		if c.Key == key {
			return c
		}
	}
	t.Fatalf("%s missing from the catalog", key)
	return Category{}
}

// tierOf é o tier da categoria (0 quando ela não aparece: escondida até o tier 1).
func tierOf(badges []Badge, key string) int {
	for _, b := range badges {
		if b.Category == key {
			return b.Tier
		}
	}
	return 0
}

// assertTiers confere nome, limite e raridade de cada tier.
func assertTiers(t *testing.T, key string, want []Tier) {
	t.Helper()
	c := category(t, key)
	if len(c.Tiers) != len(want) {
		t.Fatalf("%s tiers = %+v", key, c.Tiers)
	}
	for i, w := range want {
		if c.Tiers[i] != w {
			t.Errorf("%s tier %d = %+v, want %+v", key, i+1, c.Tiers[i], w)
		}
	}
}

// assertBackfillMatchesCatalog: toda lista "(tier, limite)" da migration usa
// os mesmos limites do catálogo.
func assertBackfillMatchesCatalog(t *testing.T, key, migration string) {
	t.Helper()
	raw, err := os.ReadFile(migration)
	if err != nil {
		t.Fatal(err)
	}
	var want []string
	for i, tier := range category(t, key).Tiers {
		want = append(want, fmt.Sprintf("(%d, %d)", i+1, tier.Threshold))
	}
	lists := regexp.MustCompile(`VALUES\s*(\(\d+, \d+\)(?:, \(\d+, \d+\))*)\s*\)?\s*AS t`).FindAllStringSubmatch(string(raw), -1)
	if len(lists) == 0 {
		t.Fatal("VALUES list not found in the migration")
	}
	for _, m := range lists {
		if got := m[1]; got != strings.Join(want, ", ") {
			t.Fatalf("migration thresholds = %s, want %s", got, strings.Join(want, ", "))
		}
	}
}

// testDB é o Postgres descartável de openTestDB com atalhos para os testes
// dos badges de uso; pula o teste sem ele.
type testDB struct {
	t   *testing.T
	ctx context.Context
	db  *pgxpool.Pool
}

func newTestDB(t *testing.T) *testDB {
	t.Helper()
	return &testDB{t: t, ctx: context.Background(), db: openTestDB(t)}
}

func (d *testDB) exec(sql string, args ...any) {
	d.t.Helper()
	if _, err := d.db.Exec(d.ctx, sql, args...); err != nil {
		d.t.Fatal(err)
	}
}

// runBackfill roda só o backfill de uma migration (os INSERT/UPDATE/WITH),
// sem o DDL: ALTER TABLE e CREATE TRIGGER travam tabelas que os testes de
// outros pacotes usam ao mesmo tempo no mesmo banco (deadlock).
func (d *testDB) runBackfill(path string) {
	d.t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		d.t.Fatal(err)
	}
	for _, stmt := range backfillStatements(string(raw)) {
		d.exec(stmt)
	}
}

var (
	functionBody = regexp.MustCompile(`(?s)\$\$.*?\$\$`)
	sqlComment   = regexp.MustCompile(`(?m)^\s*--.*$`)
	backfillVerb = regexp.MustCompile(`(?i)^(INSERT|UPDATE|WITH)\b`)
)

func backfillStatements(sql string) []string {
	sql = sqlComment.ReplaceAllString(functionBody.ReplaceAllString(sql, "$$$$"), "")
	var out []string
	for _, stmt := range strings.Split(sql, ";") {
		if stmt = strings.TrimSpace(stmt); backfillVerb.MatchString(stmt) {
			out = append(out, stmt)
		}
	}
	return out
}

// user cria uma pessoa (apagada no fim do teste) e devolve id e @.
func (d *testDB) user() (string, string) {
	d.t.Helper()
	id := uuid.NewString()
	name := "t" + strings.ReplaceAll(id, "-", "")[:12]
	d.exec(`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, id, name)
	d.t.Cleanup(func() {
		d.db.Exec(d.ctx, `DELETE FROM messages WHERE author_id = $1`, id)
		d.db.Exec(d.ctx, `DELETE FROM users WHERE id = $1`, id)
	})
	return id, name
}

// conversation abre uma DM entre a e b (para gravar mensagens nos testes).
func (d *testDB) conversation(a, b string) string {
	d.t.Helper()
	if b < a {
		a, b = b, a
	}
	var id string
	err := d.db.QueryRow(d.ctx, `INSERT INTO conversations (id, user_a_id, user_b_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, a, b).Scan(&id)
	if err != nil {
		d.t.Fatal(err)
	}
	d.t.Cleanup(func() {
		d.db.Exec(d.ctx, `DELETE FROM messages WHERE conversation_id = $1`, id)
		d.db.Exec(d.ctx, `DELETE FROM conversations WHERE id = $1`, id)
	})
	return id
}

// server cria um servidor de owner com um canal de texto (apagados no fim).
func (d *testDB) server(owner string) (serverID, channelID string) {
	d.t.Helper()
	serverID, channelID = uuid.NewString(), uuid.NewString()
	d.exec(`INSERT INTO servers (id, name, owner_id) VALUES ($1, 's', $2)`, serverID, owner)
	d.exec(`INSERT INTO channels (id, server_id, name, created_by) VALUES ($1, $2, 'geral', $3)`, channelID, serverID, owner)
	d.t.Cleanup(func() {
		d.db.Exec(d.ctx, `DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = $1)`, serverID)
		d.db.Exec(d.ctx, `DELETE FROM servers WHERE id = $1`, serverID)
	})
	return serverID, channelID
}
