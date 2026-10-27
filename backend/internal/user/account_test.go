package user

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// fakeAccountRepo guarda as contas em memória; os "taken" ignoram a caixa,
// como o banco (índices em lower()).
type fakeAccountRepo struct {
	users     map[string]*User
	uniqueErr bool // o UPDATE cai no UNIQUE (corrida entre dois pedidos)
}

func (r *fakeAccountRepo) FindByID(_ context.Context, id string) (*User, error) {
	u, ok := r.users[id]
	if !ok {
		return nil, errNoUser
	}
	copied := *u
	return &copied, nil
}

var errNoUser = errors.New("sem conta")

func (r *fakeAccountRepo) takenByOther(id string, field func(*User) string, value string) bool {
	for other, u := range r.users {
		if other != id && strings.EqualFold(field(u), value) {
			return true
		}
	}
	return false
}

func (r *fakeAccountRepo) UsernameTakenByOther(_ context.Context, id, username string) (bool, error) {
	return r.takenByOther(id, func(u *User) string { return u.Username }, username), nil
}

func (r *fakeAccountRepo) EmailTakenByOther(_ context.Context, id, email string) (bool, error) {
	return r.takenByOther(id, func(u *User) string { return u.Email }, email), nil
}

func (r *fakeAccountRepo) SetUsername(_ context.Context, id, username string) (*User, error) {
	if r.uniqueErr {
		return nil, &pgconn.PgError{Code: "23505"}
	}
	r.users[id].Username = username
	copied := *r.users[id]
	return &copied, nil
}

func (r *fakeAccountRepo) SetEmail(_ context.Context, id, email string, keepVerified bool) (*User, error) {
	if r.uniqueErr {
		return nil, &pgconn.PgError{Code: "23505"}
	}
	u := r.users[id]
	u.Email = email
	if !keepVerified {
		u.EmailVerifiedAt = nil
	}
	copied := *u
	return &copied, nil
}

func newAccountEnv() (*AccountService, *fakeAccountRepo, *fakeEvents) {
	verified := time.Now()
	repo := &fakeAccountRepo{users: map[string]*User{
		meID:    {ID: meID, Username: "ana", Email: "ana@x.com", EmailVerifiedAt: &verified},
		otherID: {ID: otherID, Username: "Bruno", Email: "bruno@x.com"},
	}}
	events := &fakeEvents{statuses: map[string]string{}}
	return NewAccountService(repo, events), repo, events
}

func TestChangeUsername(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		unique  bool
		want    string
		wantErr error
	}{
		{"troca e tira os espaços", "  ana_nova ", false, "ana_nova", nil},
		{"só a caixa do próprio nome", "Ana", false, "Ana", nil},
		{"formato inválido", "a b", false, "", ErrInvalidUsername},
		{"curto demais", "ab", false, "", ErrInvalidUsername},
		{"de outra conta, sem diferenciar caixa", "bruno", false, "", ErrUsernameTaken},
		{"reservado", "everyone", false, "", ErrUsernameReserved},
		{"corrida no UNIQUE", "livre", true, "", ErrUsernameTaken},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, repo, events := newAccountEnv()
			repo.uniqueErr = tt.unique
			u, err := svc.ChangeUsername(context.Background(), meID, tt.input)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("erro = %v, quer %v", err, tt.wantErr)
			}
			if tt.wantErr != nil {
				if len(events.published) != 0 {
					t.Error("não pode avisar os outros quando falha")
				}
				return
			}
			if u.Username != tt.want {
				t.Errorf("username = %q, quer %q", u.Username, tt.want)
			}
			if len(events.published) != 1 || events.published[0].Username != tt.want {
				t.Errorf("evento = %+v, quer o perfil com %q", events.published, tt.want)
			}
		})
	}
}

func TestChangeUsernameIgualNaoGravaNemAvisa(t *testing.T) {
	svc, _, events := newAccountEnv()
	u, err := svc.ChangeUsername(context.Background(), meID, "ana")
	if err != nil || u.Username != "ana" {
		t.Fatalf("u = %+v, err = %v", u, err)
	}
	if len(events.published) != 0 {
		t.Error("nada mudou: não precisa avisar")
	}
}

func TestChangeUsernameContaSumiu(t *testing.T) {
	svc, _, _ := newAccountEnv()
	if _, err := svc.ChangeUsername(context.Background(), "nao-existe", "livre"); err == nil {
		t.Fatal("quer erro para conta inexistente")
	}
}

func TestChangeEmail(t *testing.T) {
	tests := []struct {
		name         string
		input        string
		unique       bool
		want         string
		wantVerified bool
		wantConfirm  bool
		wantErr      error
	}{
		{"novo e-mail perde a confirmação", " nova@x.com ", false, "nova@x.com", false, true, nil},
		{"só a caixa continua confirmado", "ANA@x.com", false, "ANA@x.com", true, false, nil},
		{"igual não muda nada", "ana@x.com", false, "ana@x.com", true, false, nil},
		{"formato inválido", "ana@", false, "", false, false, ErrInvalidEmail},
		{"longo demais", strings.Repeat("a", 250) + "@x.com", false, "", false, false, ErrInvalidEmail},
		{"de outra conta, sem diferenciar caixa", "BRUNO@x.com", false, "", false, false, ErrEmailTaken},
		{"corrida no UNIQUE", "livre@x.com", true, "", false, false, ErrEmailTaken},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, repo, events := newAccountEnv()
			repo.uniqueErr = tt.unique
			u, confirm, err := svc.ChangeEmail(context.Background(), meID, tt.input)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("erro = %v, quer %v", err, tt.wantErr)
			}
			if tt.wantErr != nil {
				return
			}
			if u.Email != tt.want || (u.EmailVerifiedAt != nil) != tt.wantVerified || confirm != tt.wantConfirm {
				t.Errorf("e-mail = %q verificado = %v confirmar = %v; quer %q %v %v",
					u.Email, u.EmailVerifiedAt != nil, confirm, tt.want, tt.wantVerified, tt.wantConfirm)
			}
			// E-mail é privado: ninguém mais precisa saber.
			if len(events.published) != 0 {
				t.Error("trocar o e-mail não avisa os outros")
			}
		})
	}
}
