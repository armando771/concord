package auth

import (
	"context"
	"crypto/sha256"
	"runtime"
	"strings"
	"time"

	"gin-quickstart/backend/internal/ratelimit"
)

// Limites do login, em memória (um processo só; reiniciar zera).
const (
	loginAttemptsPerIP         = 30
	loginIPWindow              = 5 * time.Minute
	loginFailuresPerIdentifier = 10
	loginIdentifierWindow      = 15 * time.Minute
	// Teto de chaves guardadas por limitador. As chaves têm tamanho fixo
	// (IP/prefixo ou sha256 do identificador), então o teto é de memória.
	loginLimiterMaxKeys = 10000
	// Quanto um login espera por uma vaga de bcrypt antes do 429.
	loginBcryptWait = 2 * time.Second
	// Corpo máximo de /auth/login e /auth/register.
	maxLoginBodyBytes = 8 << 10
)

// loginGuard: tentativas por IP (todas contam; IPv6 por /64), tentativas por
// identificador normalizado (reservadas na entrada; acertar zera, erro
// interno devolve) e um teto de bcrypts simultâneos.
type loginGuard struct {
	byIP         *ratelimit.Limiter
	byIdentifier *ratelimit.Limiter
	bcryptSlots  chan struct{}
	bcryptWait   time.Duration
}

func newLoginGuard() *loginGuard {
	return &loginGuard{
		byIP:         ratelimit.New(loginAttemptsPerIP, loginIPWindow, loginLimiterMaxKeys),
		byIdentifier: ratelimit.New(loginFailuresPerIdentifier, loginIdentifierWindow, loginLimiterMaxKeys),
		bcryptSlots:  make(chan struct{}, 2*runtime.GOMAXPROCS(0)),
		bcryptWait:   loginBcryptWait,
	}
}

func (g *loginGuard) setClock(now func() time.Time) {
	g.byIP.SetClock(now)
	g.byIdentifier.SetClock(now)
}

// begin conta a tentativa do IP e, se houver identificador, já reserva a
// tentativa dele — no mesmo passo travado que confere o limite, para uma
// rajada simultânea não passar inteira antes do primeiro bcrypt terminar.
// id é nil quando o pedido nem trouxe identificador válido.
func (g *loginGuard) begin(ip string, id *LoginIdentifier) (time.Duration, bool) {
	if retry, ok := g.byIP.Allow(ratelimit.IPKey(ip)); !ok {
		return retry, false
	}
	if id != nil {
		if retry, ok := g.byIdentifier.Reserve(loginKey(*id)); !ok {
			return retry, false
		}
	}
	return 0, true
}

// succeeded zera o identificador (senha certa).
func (g *loginGuard) succeeded(id LoginIdentifier) { g.byIdentifier.Reset(loginKey(id)) }

// undo devolve a reserva de uma tentativa que não chegou a checar a senha
// (banco fora do ar, sem vaga de bcrypt).
func (g *loginGuard) undo(id LoginIdentifier) { g.byIdentifier.Undo(loginKey(id)) }

// acquireBcrypt pega uma vaga de bcrypt, esperando no máximo bcryptWait.
func (g *loginGuard) acquireBcrypt(ctx context.Context) bool {
	timer := time.NewTimer(g.bcryptWait)
	defer timer.Stop()
	select {
	case g.bcryptSlots <- struct{}{}:
		return true
	case <-timer.C:
		return false
	case <-ctx.Done():
		return false
	}
}

func (g *loginGuard) releaseBcrypt() { <-g.bcryptSlots }

// loginKey: o mesmo para "Nicccls", "@nicccls" e o campo antigo "email".
// Guarda só o sha256 (32 bytes), nunca o texto digitado.
func loginKey(id LoginIdentifier) string {
	prefix := "u:"
	if id.Kind == IdentifierEmail {
		prefix = "e:"
	}
	sum := sha256.Sum256([]byte(prefix + strings.ToLower(id.Value)))
	return string(sum[:])
}
