package server

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/database"

	"github.com/google/uuid"
)

// Sem canal principal escolhido, vale o canal de texto mais antigo: mudar a
// ordem dos canais na barra lateral não pode mudar para onde vão os avisos.
func TestPrimaryChannelFallbackIgnoresSidebarOrder(t *testing.T) {
	if strings.Contains(primaryChannelColumn, "position") {
		t.Fatalf("fallback do canal principal não pode seguir a ordem da barra: %s", primaryChannelColumn)
	}
	if !strings.Contains(primaryChannelColumn, "ORDER BY c.created_at, c.id") {
		t.Fatalf("fallback do canal principal deve ser o canal de texto mais antigo: %s", primaryChannelColumn)
	}
}

// Mesmo teste num Postgres de verdade (TEST_DATABASE_URL, banco descartável).
func TestPrimaryChannelFallbackDB(t *testing.T) {
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

	owner, serverID := uuid.NewString(), uuid.NewString()
	oldest, newer := uuid.NewString(), uuid.NewString()
	name := "u" + owner[:8]
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2, $2, $2 || '@ex.com', 'x')`, owner, name)
	t.Cleanup(func() {
		db.Exec(ctx, `DELETE FROM servers WHERE id = $1`, serverID)
		db.Exec(ctx, `DELETE FROM users WHERE id = $1`, owner)
	})
	exec(`INSERT INTO servers (id, name, owner_id) VALUES ($1, 's', $2)`, serverID, owner)
	t0 := time.Now().Add(-time.Hour)
	exec(`INSERT INTO channels (id, server_id, name, type, created_by, created_at, position) VALUES ($1, $2, 'antigo', 'text', $3, $4, 0)`, oldest, serverID, owner, t0)
	exec(`INSERT INTO channels (id, server_id, name, type, created_by, created_at, position) VALUES ($1, $2, 'novo', 'text', $3, $4, 1)`, newer, serverID, owner, t0.Add(time.Minute))

	// Moderador arrasta o canal novo para o topo.
	exec(`UPDATE channels SET position = CASE WHEN id = $1 THEN 0 ELSE 1 END WHERE server_id = $2`, newer, serverID)

	s, err := ServerRepository(db).FindByID(ctx, serverID)
	if err != nil {
		t.Fatal(err)
	}
	if s.PrimaryChannelID == nil || *s.PrimaryChannelID != oldest {
		t.Fatalf("canal principal = %v, want o mais antigo (%s)", s.PrimaryChannelID, oldest)
	}
}
