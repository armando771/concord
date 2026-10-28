package soundboard

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/platform/database"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Estes testes rodam num Postgres de verdade (TEST_DATABASE_URL, banco
// descartável e já migrado: o teste não roda as migrations) e cobrem o SQL
// da listagem por servidor e dos favoritos, com as cascatas.

func favoritesDB(t *testing.T) (*pgxpool.Pool, context.Context) {
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
	return db, context.Background()
}

func dbExec(t *testing.T, db *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := db.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
}

// dbUser cria um usuário (apagado no fim, com o que é dele em cascata).
func dbUser(t *testing.T, db *pgxpool.Pool) string {
	t.Helper()
	id := uuid.NewString()
	name := "u" + strings.ReplaceAll(id, "-", "")[:10]
	dbExec(t, db, `INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, id, name)
	t.Cleanup(func() { db.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id) })
	return id
}

func dbServer(t *testing.T, db *pgxpool.Pool, owner, name string) string {
	t.Helper()
	id := uuid.NewString()
	dbExec(t, db, `INSERT INTO servers (id, name, owner_id) VALUES ($1, $2, $3)`, id, name, owner)
	t.Cleanup(func() { db.Exec(context.Background(), `DELETE FROM servers WHERE id = $1`, id) })
	return id
}

func dbSound(t *testing.T, repo *Repository, serverID, uploader, name string) Sound {
	t.Helper()
	s := Sound{ID: uuid.NewString(), ServerID: serverID, UploaderID: uploader, Name: name,
		ContentType: "audio/wav", SizeBytes: 10, DurationMs: 1000}
	if err := repo.Create(context.Background(), &s); err != nil {
		t.Fatal(err)
	}
	return s
}

func ids(sounds []Sound) []string {
	out := make([]string, len(sounds))
	for i, s := range sounds {
		out[i] = s.ID
	}
	return out
}

func favIDs(favs []FavoriteSound) []string {
	out := make([]string, len(favs))
	for i, f := range favs {
		out[i] = f.ID
	}
	return out
}

func TestListByServerOnlyThatServerDB(t *testing.T) {
	db, ctx := favoritesDB(t)
	repo := NewRepository(db)
	ana := dbUser(t, db)
	a, b := dbServer(t, db, ana, "A"), dbServer(t, db, ana, "B")
	somA := dbSound(t, repo, a, ana, "do A")
	dbSound(t, repo, b, ana, "do B")

	got, err := repo.ListByServer(ctx, a)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != somA.ID {
		t.Fatalf("ListByServer(A) = %v, want só %s", ids(got), somA.ID)
	}
}

func TestFavoritesAcrossServersDB(t *testing.T) {
	db, ctx := favoritesDB(t)
	repo := NewRepository(db)
	ana, bia := dbUser(t, db), dbUser(t, db)
	a, b := dbServer(t, db, ana, "Servidor A"), dbServer(t, db, bia, "Servidor B")
	somA := dbSound(t, repo, a, ana, "buzina")
	somB := dbSound(t, repo, b, bia, "corneta")

	for _, id := range []string{somA.ID, somB.ID, somB.ID} { // repetir não é erro
		if err := repo.AddFavorite(ctx, ana, id, 10); err != nil {
			t.Fatalf("AddFavorite(%s): %v", id, err)
		}
	}
	favs, err := repo.ListFavorites(ctx, ana)
	if err != nil {
		t.Fatal(err)
	}
	if len(favs) != 2 || favs[0].ID != somB.ID || favs[1].ID != somA.ID {
		t.Fatalf("favoritos = %v, want [B, A] (mais novo primeiro)", favIDs(favs))
	}
	if favs[0].ServerName != "Servidor B" || favs[0].Name != "corneta" || favs[0].UploaderName == "" {
		t.Errorf("favorito sem dados da origem: %+v", favs[0])
	}
	if ok, err := repo.IsFavorite(ctx, ana, somB.ID); err != nil || !ok {
		t.Errorf("IsFavorite(ana, B) = %v, %v", ok, err)
	}
	if ok, _ := repo.IsFavorite(ctx, bia, somB.ID); ok {
		t.Error("favorito é por usuário")
	}

	// Som apagado na origem some dos favoritos.
	if err := repo.Delete(ctx, somB.ID); err != nil {
		t.Fatal(err)
	}
	favs, _ = repo.ListFavorites(ctx, ana)
	if len(favs) != 1 || favs[0].ID != somA.ID {
		t.Fatalf("depois de apagar B: %v", favIDs(favs))
	}

	if err := repo.RemoveFavorite(ctx, ana, somA.ID); err != nil {
		t.Fatal(err)
	}
	if err := repo.RemoveFavorite(ctx, ana, somA.ID); err != nil {
		t.Fatalf("tirar de novo não é erro: %v", err)
	}
	if favs, _ = repo.ListFavorites(ctx, ana); len(favs) != 0 {
		t.Fatalf("favoritos = %v, want vazio", favIDs(favs))
	}
}

func TestAddFavoriteLimitDB(t *testing.T) {
	db, ctx := favoritesDB(t)
	repo := NewRepository(db)
	ana := dbUser(t, db)
	srv := dbServer(t, db, ana, "A")
	um, dois := dbSound(t, repo, srv, ana, "um"), dbSound(t, repo, srv, ana, "dois")

	if err := repo.AddFavorite(ctx, ana, um.ID, 1); err != nil {
		t.Fatal(err)
	}
	if err := repo.AddFavorite(ctx, ana, um.ID, 1); err != nil {
		t.Fatalf("o que já está não conta contra o limite: %v", err)
	}
	if err := repo.AddFavorite(ctx, ana, dois.ID, 1); !errors.Is(err, ErrFavoritesFull) {
		t.Fatalf("passou do limite: err = %v, want ErrFavoritesFull", err)
	}
}
