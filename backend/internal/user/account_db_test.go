package user

import (
	"context"
	"os"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/platform/database"

	"github.com/google/uuid"
)

// Troca de @ e e-mail num Postgres de verdade (TEST_DATABASE_URL, banco
// descartável): o "já existe" ignora a caixa e a própria conta, e o e-mail
// novo perde a confirmação.
func TestAccountRepositoryDB(t *testing.T) {
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

	insert := func() (string, string) {
		id := uuid.NewString()
		name := "t" + strings.ReplaceAll(id, "-", "")[:12]
		if _, err := db.Exec(ctx, `INSERT INTO users (id, username, display_name, email, password_hash, email_verified_at) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x', NOW())`, id, name); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id) })
		return id, name
	}
	me, myName := insert()
	_, otherName := insert()
	repo := UserRepository(db)

	if taken, err := repo.UsernameTakenByOther(ctx, me, strings.ToUpper(myName)); err != nil || taken {
		t.Fatalf("o próprio nome não conta como ocupado: taken=%v err=%v", taken, err)
	}
	if taken, err := repo.UsernameTakenByOther(ctx, me, strings.ToUpper(otherName)); err != nil || !taken {
		t.Fatalf("nome de outra conta (outra caixa) = taken=%v err=%v", taken, err)
	}
	if taken, err := repo.EmailTakenByOther(ctx, me, strings.ToUpper(otherName)+"@EX.COM"); err != nil || !taken {
		t.Fatalf("e-mail de outra conta (outra caixa) = taken=%v err=%v", taken, err)
	}

	u, err := repo.SetUsername(ctx, me, myName+"_x")
	if err != nil || u.Username != myName+"_x" {
		t.Fatalf("SetUsername = %+v, %v", u, err)
	}
	u, err = repo.SetEmail(ctx, me, strings.ToUpper(myName)+"@ex.com", true)
	if err != nil || u.EmailVerifiedAt == nil {
		t.Fatalf("só a caixa mantém a confirmação: %+v, %v", u, err)
	}
	u, err = repo.SetEmail(ctx, me, myName+"@novo.com", false)
	if err != nil || u.Email != myName+"@novo.com" || u.EmailVerifiedAt != nil {
		t.Fatalf("e-mail novo perde a confirmação: %+v, %v", u, err)
	}
}
