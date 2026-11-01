package guest

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"gin-quickstart/backend/internal/platform/database"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Roda num Postgres de verdade (TEST_DATABASE_URL, banco descartável já com
// as migrations aplicadas): o SQL do repositório e as cascatas.
func guestDB(t *testing.T) *pgxpool.Pool {
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
	var table *string
	if err := db.QueryRow(context.Background(), `SELECT to_regclass('call_guest_invites')::text`).Scan(&table); err != nil || table == nil {
		t.Skip("banco sem a migration dos visitantes")
	}
	return db
}

// seedServer: dono, servidor e canal de voz.
func seedServer(t *testing.T, db *pgxpool.Pool) (ownerID, serverID, channelID string) {
	t.Helper()
	ctx := context.Background()
	ownerID, serverID, channelID = uuid.NewString(), uuid.NewString(), uuid.NewString()
	name := "u" + ownerID[:8]
	exec := func(q string, args ...any) {
		if _, err := db.Exec(ctx, q, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, ownerID, name)
	exec(`INSERT INTO servers (id, name, owner_id) VALUES ($1, 'S', $2)`, serverID, ownerID)
	exec(`INSERT INTO channels (id, server_id, name, type, created_by) VALUES ($1, $2, 'voz', 'voice', $3)`, channelID, serverID, ownerID)
	t.Cleanup(func() {
		db.Exec(ctx, `DELETE FROM servers WHERE id = $1`, serverID)
		db.Exec(ctx, `DELETE FROM users WHERE id = $1`, ownerID)
	})
	return ownerID, serverID, channelID
}

func TestRepositoryInviteAndPassLifecycle(t *testing.T) {
	db := guestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()
	owner, srv, ch := seedServer(t, db)
	now := time.Now().UTC().Truncate(time.Microsecond)

	inv := &Invite{ID: uuid.NewString(), ServerID: srv, ChannelID: ch, CreatedBy: owner, Permissions: AllowedPerms, ExpiresAt: now.Add(time.Hour), CreatedAt: now}
	if err := repo.CreateInvite(ctx, inv, "hash-"+inv.ID); err != nil {
		t.Fatal(err)
	}
	got, err := repo.InviteByHash(ctx, "hash-"+inv.ID)
	if err != nil || got.ID != inv.ID || got.Permissions != AllowedPerms || !got.ExpiresAt.Equal(inv.ExpiresAt) {
		t.Fatalf("InviteByHash = %+v, %v", got, err)
	}
	if _, err := repo.InviteByID(ctx, uuid.NewString()); !errors.Is(err, ErrNotFound) {
		t.Fatalf("convite inexistente: %v", err)
	}

	u := newGuestUser("Visita")
	if err := repo.CreateGuestUser(ctx, u); err != nil {
		t.Fatal(err)
	}
	pass := &Pass{ID: uuid.NewString(), InviteID: inv.ID, UserID: u.ID, ChannelID: ch}
	if err := repo.CreatePass(ctx, pass); err != nil {
		t.Fatal(err)
	}
	if n, _ := repo.CountPasses(ctx, inv.ID); n != 1 {
		t.Fatalf("CountPasses = %d", n)
	}
	p, err := repo.PassFor(ctx, inv.ID, u.ID)
	if err != nil || p.ServerID != srv || p.Permissions != AllowedPerms || p.EndedAt != nil {
		t.Fatalf("PassFor = %+v, %v", p, err)
	}
	active, err := repo.ActivePasses(ctx, now)
	if err != nil || !containsPass(active, pass.ID) {
		t.Fatalf("ActivePasses = %+v, %v", active, err)
	}
	list, _ := repo.InvitesOfChannel(ctx, ch, now)
	guests, err := repo.GuestsOf(ctx, []string{inv.ID})
	if len(list) != 1 || err != nil || len(guests) != 1 || guests[0].DisplayName != "Visita" {
		t.Fatalf("lista = %+v / %+v, %v", list, guests, err)
	}

	if err := repo.EndPass(ctx, pass.ID, now); err != nil {
		t.Fatal(err)
	}
	if active, _ := repo.ActivePasses(ctx, now); containsPass(active, pass.ID) {
		t.Fatal("acesso encerrado não é ativo")
	}
	if err := repo.RevokeInvite(ctx, inv.ID, now); err != nil {
		t.Fatal(err)
	}
	if list, _ := repo.InvitesOfChannel(ctx, ch, now); len(list) != 0 {
		t.Fatal("revogado sai da lista")
	}

	// Visitante sem acesso há mais de uma hora é apagado (e o acesso junto).
	if _, err := repo.DeleteStaleGuests(ctx, time.Now().Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.PassFor(ctx, inv.ID, u.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("o usuário de visitante devia ter sido apagado: %v", err)
	}
}

func TestRepositoryMovePass(t *testing.T) {
	db := guestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()
	owner, srv, ch := seedServer(t, db)
	other := uuid.NewString()
	if _, err := db.Exec(ctx, `INSERT INTO channels (id, server_id, name, type, created_by) VALUES ($1, $2, 'voz2', 'voice', $3)`, other, srv, owner); err != nil {
		t.Fatal(err)
	}
	inv := &Invite{ID: uuid.NewString(), ServerID: srv, ChannelID: ch, CreatedBy: owner, ExpiresAt: time.Now().Add(time.Hour), CreatedAt: time.Now()}
	_ = repo.CreateInvite(ctx, inv, "hash-"+inv.ID)
	u := newGuestUser("Visita")
	_ = repo.CreateGuestUser(ctx, u)
	t.Cleanup(func() { db.Exec(ctx, `DELETE FROM users WHERE id = $1`, u.ID) })
	pass := &Pass{ID: uuid.NewString(), InviteID: inv.ID, UserID: u.ID, ChannelID: ch}
	_ = repo.CreatePass(ctx, pass)

	if err := repo.MovePass(ctx, pass.ID, other); err != nil {
		t.Fatal(err)
	}
	if p, _ := repo.PassFor(ctx, inv.ID, u.ID); p.ChannelID != other {
		t.Fatalf("canal = %s, want %s", p.ChannelID, other)
	}
}

func containsPass(passes []Pass, id string) bool {
	for _, p := range passes {
		if p.ID == id {
			return true
		}
	}
	return false
}
