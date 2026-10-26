package user

import (
	"context"
	"os"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/database"
	"gin-quickstart/backend/internal/profiletheme"

	"github.com/google/uuid"
)

// Tema do perfil num Postgres de verdade (TEST_DATABASE_URL, banco
// descartável): padrão da migration, gravação e "sem campo não apaga".
func TestProfileThemeDB(t *testing.T) {
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

	id := uuid.NewString()
	name := "t" + strings.ReplaceAll(id, "-", "")[:12]
	if _, err := db.Exec(ctx, `INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, id, name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id) })

	repo := UserRepository(db)
	u, err := repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if u.ProfileTheme.Border != "none" || u.ProfileTheme.Background != "default" || u.ProfileTheme.Effect != "none" || u.ProfileTheme.BorderColors == nil {
		t.Fatalf("padrão = %+v", u.ProfileTheme)
	}

	theme := profiletheme.Theme{
		Border: "neon", BorderColors: []string{"#00ffaa"},
		Background: "gradient", BackgroundColors: []string{"#1e1b4b", "#0f172a"},
		Effect: "snow",
	}
	in := ProfileInput{DisplayName: "Tema", Links: []ProfileLink{}, ProfileTheme: &theme}
	u, err = repo.UpdateProfile(ctx, id, in)
	if err != nil {
		t.Fatal(err)
	}
	if u.ProfileTheme.Border != "neon" || u.ProfileTheme.BackgroundColors[1] != "#0f172a" || u.ProfileTheme.Effect != "snow" {
		t.Fatalf("gravado = %+v", u.ProfileTheme)
	}

	in.ProfileTheme = nil
	u, err = repo.UpdateProfile(ctx, id, in)
	if err != nil {
		t.Fatal(err)
	}
	if u.ProfileTheme.Border != "neon" || len(u.ProfileTheme.BorderColors) != 1 {
		t.Fatalf("sem campo apagou o tema: %+v", u.ProfileTheme)
	}

	// Voltar ao padrão grava listas vazias ('{}'), nunca NULL.
	def := profiletheme.Default()
	in.ProfileTheme = &def
	u, err = repo.UpdateProfile(ctx, id, in)
	if err != nil {
		t.Fatal(err)
	}
	if u.ProfileTheme.Border != "none" || u.ProfileTheme.BorderColors == nil || len(u.ProfileTheme.BackgroundColors) != 0 {
		t.Fatalf("padrão de novo = %+v", u.ProfileTheme)
	}
}
