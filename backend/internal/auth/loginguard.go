package auth

import (
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
	// Teto de chaves guardadas por limitador (~1 MB cada no pior caso).
	loginLimiterMaxKeys = 10000
)

// loginGuard: tentativas por IP (todas contam) e falhas por identificador
// normalizado (só senha errada/conta inexistente contam; acertar zera).
type loginGuard struct {
	byIP         *ratelimit.Limiter
	byIdentifier *ratelimit.Limiter
}

func newLoginGuard() *loginGuard {
	return &loginGuard{
		byIP:         ratelimit.New(loginAttemptsPerIP, loginIPWindow, loginLimiterMaxKeys),
		byIdentifier: ratelimit.New(loginFailuresPerIdentifier, loginIdentifierWindow, loginLimiterMaxKeys),
	}
}

func (g *loginGuard) setClock(now func() time.Time) {
	g.byIP.SetClock(now)
	g.byIdentifier.SetClock(now)
}

// allow conta a tentativa do IP e diz se ela pode seguir. id é nil quando o
// pedido nem trouxe identificador.
func (g *loginGuard) allow(ip string, id *LoginIdentifier) (time.Duration, bool) {
	if retry, ok := g.byIP.Allow(ip); !ok {
		return retry, false
	}
	if id != nil {
		if retry, blocked := g.byIdentifier.Blocked(loginKey(*id)); blocked {
			return retry, false
		}
	}
	return 0, true
}

func (g *loginGuard) failed(id LoginIdentifier)    { g.byIdentifier.Hit(loginKey(id)) }
func (g *loginGuard) succeeded(id LoginIdentifier) { g.byIdentifier.Reset(loginKey(id)) }

// loginKey: o mesmo para "Nicccls", "@nicccls" e o campo antigo "email".
func loginKey(id LoginIdentifier) string {
	prefix := "u:"
	if id.Kind == IdentifierEmail {
		prefix = "e:"
	}
	return prefix + strings.ToLower(id.Value)
}
