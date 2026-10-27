package user

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/platform/database"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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

	// O cadastro não conta como troca.
	if u, _ := repo.FindByID(ctx, me); u.UsernameChangedAt != nil {
		t.Fatal("conta nova já com data de troca do @")
	}
	cutoff := time.Now().Add(-UsernameCooldown)
	u, err := repo.SetUsername(ctx, me, strings.ToUpper(myName), cutoff)
	if err != nil || u.UsernameChangedAt != nil {
		t.Fatalf("só a caixa não marca a data: %+v, %v", u, err)
	}
	u, err = repo.SetUsername(ctx, me, myName+"_x", cutoff)
	if err != nil || u.Username != myName+"_x" || u.UsernameChangedAt == nil {
		t.Fatalf("SetUsername = %+v, %v", u, err)
	}
	// Dentro do prazo, o UPDATE não pega a linha (corrida entre dois pedidos).
	if _, err := repo.SetUsername(ctx, me, myName+"_y", time.Now().Add(-UsernameCooldown)); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("dentro do prazo = %v, quer pgx.ErrNoRows", err)
	}
	// Só a caixa passa mesmo dentro do prazo.
	if _, err := repo.SetUsername(ctx, me, strings.ToUpper(myName+"_x"), time.Now().Add(-UsernameCooldown)); err != nil {
		t.Fatalf("só a caixa dentro do prazo: %v", err)
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
