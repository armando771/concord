package user

import (
	"context"
	"os"
	"testing"

	"gin-quickstart/backend/internal/platform/database"

	"github.com/google/uuid"
)

// Visitantes de call (usuários efêmeros) não aparecem na busca nem recebem
// pedido de amizade pelo @ (docs/adr/0017-visitante-na-call.md).
func TestGuestUsersAreHiddenFromSearchAndFriendLookup(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	db, err := database.Connect(url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	var col *string
	if err := db.QueryRow(ctx, `SELECT column_name::text FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_guest'`).Scan(&col); err != nil {
		t.Skip("banco sem a migration dos visitantes")
	}

	suffix := uuid.NewString()[:8]
	member, guest := uuid.NewString(), uuid.NewString()
	for _, u := range []struct {
		id, name string
		guest    bool
	}{{member, "buscavel_" + suffix, false}, {guest, "buscavel-" + suffix, true}} {
		if _, err := db.Exec(ctx, `INSERT INTO users (id, username, display_name, email, password_hash, is_guest) VALUES ($1, $2, $2, $4, 'x', $3)`, u.id, u.name, u.guest, u.id+"@ex.com"); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, `DELETE FROM users WHERE id = $1`, u.id)
	}

	repo := UserRepository(db)
	found, err := repo.SearchByUsername(ctx, suffix, uuid.NewString())
	if err != nil || len(found) != 1 || found[0].ID != member {
		t.Fatalf("busca = %+v, %v; want só o membro", found, err)
	}
	if _, err := repo.FindByUsernameFold(ctx, "buscavel-"+suffix); err == nil {
		t.Fatal("pedido de amizade não acha visitante")
	}
	if u, err := repo.FindByUsernameFold(ctx, "BUSCAVEL_"+suffix); err != nil || u.ID != member {
		t.Fatalf("conta comum continua achável: %v", err)
	}
}
