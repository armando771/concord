package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"gin-quickstart/backend/internal/user"
)

var fixedNow = time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)

func TestLoginKeyNormalizesIdentifier(t *testing.T) {
	same := [][2]string{{"nicccls", ""}, {"@NICCCLS", ""}, {"  NiCcCls ", ""}, {"", "nicccls"}}
	want := ""
	for _, c := range same {
		id, _ := ParseLoginIdentifier(c[0], c[1])
		key := loginKey(id)
		if want == "" {
			want = key
		} else if key != want {
			t.Errorf("loginKey(%q, %q) = %q, want %q", c[0], c[1], key, want)
		}
	}
	email, _ := ParseLoginIdentifier("Voce@Exemplo.com", "")
	email2, _ := ParseLoginIdentifier("voce@exemplo.COM", "")
	if loginKey(email) != loginKey(email2) {
		t.Error("e-mail com caixa diferente deveria dar a mesma chave")
	}
	if loginKey(email) == want {
		t.Error("e-mail e usuário não podem dividir chave")
	}
}

func TestLoginKeyIsFixedSizeHash(t *testing.T) {
	long, ok := ParseLoginIdentifier(strings.Repeat("a", maxIdentifierBytes), "")
	if !ok {
		t.Fatal("identificador no limite deveria valer")
	}
	short, _ := ParseLoginIdentifier("ab", "")
	for _, id := range []LoginIdentifier{long, short} {
		key := loginKey(id)
		if len(key) != 32 {
			t.Errorf("loginKey(%d bytes) tem %d bytes, want 32 (sha256)", len(id.Value), len(key))
		}
		if strings.Contains(key, id.Value) {
			t.Error("a chave não pode guardar o identificador em claro")
		}
	}
	// Mesmo texto, tipos diferentes: chaves diferentes.
	asUser := LoginIdentifier{Kind: IdentifierUsername, Value: "x@y.z"}
	asEmail := LoginIdentifier{Kind: IdentifierEmail, Value: "x@y.z"}
	if loginKey(asUser) == loginKey(asEmail) {
		t.Error("usuário e e-mail com o mesmo texto não podem dividir chave")
	}
}

func TestIPKeyGroupsIPv6By64(t *testing.T) {
	cases := []struct{ a, b string }{
		{"2001:db8:1:2:aaaa::1", "2001:db8:1:2:bbbb:cccc:dddd:9"},
		{"2001:db8:1:2::1", "2001:0db8:0001:0002:0000:0000:0000:0002"},
	}
	for _, c := range cases {
		if ipKey(c.a) != ipKey(c.b) {
			t.Errorf("ipKey(%q) = %q e ipKey(%q) = %q, want o mesmo /64", c.a, ipKey(c.a), c.b, ipKey(c.b))
		}
	}
	if ipKey("2001:db8:1:2::1") == ipKey("2001:db8:1:3::1") {
		t.Error("/64 diferentes não podem dividir chave")
	}
	if got := ipKey("203.0.113.7"); got != "203.0.113.7" {
		t.Errorf("IPv4 = %q, want o endereço inteiro", got)
	}
	if ipKey("203.0.113.7") == ipKey("203.0.113.8") {
		t.Error("IPv4 vizinhos não podem dividir chave")
	}
	if got := ipKey("::ffff:203.0.113.7"); got != "203.0.113.7" {
		t.Errorf("IPv4 mapeado = %q, want 203.0.113.7", got)
	}
	if got := ipKey("não-é-ip"); got != "não-é-ip" {
		t.Errorf("texto qualquer = %q, want igual", got)
	}
}

func TestLoginGuardSuccessResetsIdentifier(t *testing.T) {
	g := newLoginGuard()
	id, _ := ParseLoginIdentifier("nicccls", "")
	for i := 0; i < loginFailuresPerIdentifier-1; i++ {
		if _, ok := g.begin(fmt.Sprintf("203.0.113.%d", i), &id); !ok {
			t.Fatalf("tentativa %d bloqueada", i+1)
		}
	}
	g.succeeded(id)
	for i := 0; i < loginFailuresPerIdentifier; i++ {
		if _, ok := g.begin(fmt.Sprintf("198.51.100.%d", i), &id); !ok {
			t.Fatalf("depois do sucesso, tentativa %d bloqueada: o sucesso não zerou", i+1)
		}
	}
	if _, ok := g.begin("192.0.2.1", &id); ok {
		t.Fatal("10 tentativas seguidas deveriam bloquear o identificador")
	}
}

// fakeLogins: sem user, nenhuma conta existe; com err, o banco falha.
type fakeLogins struct {
	calls atomic.Int32
	user  *user.User
	err   error
}

func (f *fakeLogins) find() (*user.User, error) {
	f.calls.Add(1)
	if f.err != nil {
		return nil, f.err
	}
	if f.user == nil {
		return nil, user.ErrLoginNotFound
	}
	u := *f.user
	return &u, nil
}

func (f *fakeLogins) FindLoginByEmail(context.Context, string) (*user.User, error) {
	return f.find()
}

func (f *fakeLogins) FindLoginByUsername(context.Context, string) (*user.User, error) {
	return f.find()
}

// countingCompare conta as checagens de senha (cada uma é um bcrypt de
// verdade no handler) e segura cada uma por hold.
type countingCompare struct {
	calls atomic.Int32
	hold  time.Duration
}

func (cc *countingCompare) compare(hash, password []byte) error {
	cc.calls.Add(1)
	time.Sleep(cc.hold)
	return bcrypt.ErrMismatchedHashAndPassword
}

func testHandler(logins *fakeLogins) (*Handler, *countingCompare) {
	h := AuthHandler(nil, nil)
	h.logins = logins
	cc := &countingCompare{}
	h.compareHash = cc.compare
	h.guard.setClock(func() time.Time { return fixedNow })
	return h, cc
}

func loginRouter(h *Handler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	AuthRoutes(router.Group(""), h, func(c *gin.Context) { c.Next() })
	return router
}

func postLogin(router *gin.Engine, ip, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if strings.Contains(ip, ":") {
		req.RemoteAddr = "[" + ip + "]:40000"
	} else {
		req.RemoteAddr = ip + ":40000"
	}
	router.ServeHTTP(w, req)
	return w
}

func assertTooMany(t *testing.T, w *httptest.ResponseRecorder, retryAfter string) {
	t.Helper()
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", w.Code)
	}
	if got := w.Header().Get("Retry-After"); got != retryAfter {
		t.Errorf("Retry-After = %q, want %q", got, retryAfter)
	}
	if !strings.Contains(w.Body.String(), "invalid credentials") {
		t.Errorf("body = %s, want a mensagem genérica", w.Body.String())
	}
}

func TestLoginRateLimitsByIP(t *testing.T) {
	h, _ := testHandler(&fakeLogins{})
	router := loginRouter(h)

	for i := 0; i < loginAttemptsPerIP; i++ {
		if w := postLogin(router, "203.0.113.1", `{"login":"@","password":"x"}`); w.Code != http.StatusUnauthorized {
			t.Fatalf("tentativa %d: status = %d, want 401", i+1, w.Code)
		}
	}
	assertTooMany(t, postLogin(router, "203.0.113.1", `{"login":"@","password":"x"}`), "300")

	if w := postLogin(router, "203.0.113.2", `{"login":"@","password":"x"}`); w.Code != http.StatusUnauthorized {
		t.Fatalf("outro IP: status = %d, want 401", w.Code)
	}
}

func TestLoginIPv6RotationInsideSlash64IsOneIP(t *testing.T) {
	h, _ := testHandler(&fakeLogins{})
	router := loginRouter(h)

	for i := 0; i < loginAttemptsPerIP; i++ {
		ip := fmt.Sprintf("2001:db8:1:2:%x::%x", i, i+1)
		if w := postLogin(router, ip, `{"login":"@","password":"x"}`); w.Code != http.StatusUnauthorized {
			t.Fatalf("tentativa %d: status = %d, want 401", i+1, w.Code)
		}
	}
	assertTooMany(t, postLogin(router, "2001:db8:1:2:ffff::1", `{"login":"@","password":"x"}`), "300")

	if w := postLogin(router, "2001:db8:1:3::1", `{"login":"@","password":"x"}`); w.Code != http.StatusUnauthorized {
		t.Fatalf("outro /64: status = %d, want 401", w.Code)
	}
}

func TestLoginRateLimitsByIdentifier(t *testing.T) {
	logins := &fakeLogins{}
	h, cc := testHandler(logins)
	router := loginRouter(h)

	// Mesma conta escrita de jeitos diferentes, de IPs diferentes.
	forms := []string{"nicccls", "@nicccls", "NICCCLS", "@NiCcCls"}
	for i := 0; i < loginFailuresPerIdentifier; i++ {
		body := `{"login":"` + forms[i%len(forms)] + `","password":"errada"}`
		if w := postLogin(router, fmt.Sprintf("198.51.100.%d", i+1), body); w.Code != http.StatusUnauthorized {
			t.Fatalf("falha %d: status = %d, want 401", i+1, w.Code)
		}
	}
	calls, compares := logins.calls.Load(), cc.calls.Load()

	assertTooMany(t, postLogin(router, "192.0.2.50", `{"email":"Nicccls","password":"certa?"}`), "900")
	if logins.calls.Load() != calls || cc.calls.Load() != compares {
		t.Error("bloqueado não pode nem procurar a conta (nem gastar bcrypt)")
	}

	if w := postLogin(router, "192.0.2.50", `{"login":"outra","password":"x"}`); w.Code != http.StatusUnauthorized {
		t.Errorf("outro identificador: status = %d, want 401", w.Code)
	}
}

func TestLoginBlockExpires(t *testing.T) {
	h, _ := testHandler(&fakeLogins{})
	now := fixedNow
	h.guard.setClock(func() time.Time { return now })
	router := loginRouter(h)

	for i := 0; i < loginFailuresPerIdentifier; i++ {
		postLogin(router, "198.51.100.1", `{"login":"shaco","password":"x"}`)
	}
	now = now.Add(10 * time.Minute)
	assertTooMany(t, postLogin(router, "198.51.100.2", `{"login":"shaco","password":"x"}`), "300")

	now = now.Add(5 * time.Minute)
	if w := postLogin(router, "198.51.100.2", `{"login":"shaco","password":"x"}`); w.Code != http.StatusUnauthorized {
		t.Fatalf("depois de 15 min: status = %d, want 401", w.Code)
	}
}

// A-I1: o limite por identificador vale mesmo com rajada simultânea de
// muitos IPs — cada pedido reserva sua vaga antes do bcrypt.
func TestConcurrentWrongPasswordsCheckAtMostTenPasswords(t *testing.T) {
	logins := &fakeLogins{user: &user.User{ID: "u1", Username: "nicccls", PasswordHash: "x"}}
	h, cc := testHandler(logins)
	cc.hold = 20 * time.Millisecond // janela larga, como um bcrypt de verdade
	router := loginRouter(h)

	var wg sync.WaitGroup
	codes := make([]int, 60)
	start := make(chan struct{})
	for i := range codes {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			codes[i] = postLogin(router, fmt.Sprintf("198.51.%d.%d", i/250, i%250+1), `{"login":"nicccls","password":"errada"}`).Code
		}(i)
	}
	close(start)
	wg.Wait()

	unauthorized, tooMany := 0, 0
	for _, code := range codes {
		switch code {
		case http.StatusUnauthorized:
			unauthorized++
		case http.StatusTooManyRequests:
			tooMany++
		default:
			t.Errorf("status inesperado %d", code)
		}
	}
	if got := cc.calls.Load(); got > loginFailuresPerIdentifier {
		t.Fatalf("%d checagens de senha para 60 pedidos simultâneos, want no máximo %d", got, loginFailuresPerIdentifier)
	}
	if unauthorized != loginFailuresPerIdentifier || tooMany != 60-loginFailuresPerIdentifier {
		t.Errorf("401 = %d e 429 = %d, want %d e %d", unauthorized, tooMany, loginFailuresPerIdentifier, 60-loginFailuresPerIdentifier)
	}
}

func TestLoginDatabaseErrorGivesTheReservationBack(t *testing.T) {
	logins := &fakeLogins{err: errors.New("banco fora do ar")}
	h, cc := testHandler(logins)
	router := loginRouter(h)

	for i := 0; i < 3*loginFailuresPerIdentifier; i++ {
		if w := postLogin(router, fmt.Sprintf("198.51.100.%d", i+1), `{"login":"nicccls","password":"x"}`); w.Code != http.StatusUnauthorized {
			t.Fatalf("erro de banco %d: status = %d, want 401", i+1, w.Code)
		}
	}
	if cc.calls.Load() != 0 {
		t.Error("erro de banco não deveria gastar bcrypt")
	}
	// Nenhuma das falhas de banco contou: o identificador segue livre.
	if _, blocked := h.guard.byIdentifier.Blocked(loginKey(LoginIdentifier{Kind: IdentifierUsername, Value: "nicccls"})); blocked {
		t.Fatal("erros de banco bloquearam o identificador")
	}
}

// A-I3: no máximo N bcrypts ao mesmo tempo; quem não consegue vaga a tempo
// recebe o 429 genérico e não gasta a reserva do identificador.
func TestLoginBcryptSlotsAreBounded(t *testing.T) {
	logins := &fakeLogins{user: &user.User{ID: "u1", Username: "nicccls", PasswordHash: "x"}}
	h, _ := testHandler(logins)
	h.guard.bcryptSlots = make(chan struct{}, 1)
	h.guard.bcryptWait = 50 * time.Millisecond
	release := make(chan struct{})
	var compares atomic.Int32
	h.compareHash = func(_, _ []byte) error {
		compares.Add(1)
		<-release
		return bcrypt.ErrMismatchedHashAndPassword
	}
	router := loginRouter(h)

	first := make(chan int)
	go func() { first <- postLogin(router, "198.51.100.1", `{"login":"nicccls","password":"x"}`).Code }()
	for compares.Load() == 0 {
		time.Sleep(time.Millisecond)
	}

	w := postLogin(router, "198.51.100.2", `{"login":"shaco","password":"x"}`)
	assertTooMany(t, w, "1")
	close(release)
	if code := <-first; code != http.StatusUnauthorized {
		t.Fatalf("primeiro pedido: status = %d, want 401", code)
	}
	if got := compares.Load(); got != 1 {
		t.Errorf("%d bcrypts, want 1 (o segundo não pegou vaga)", got)
	}
	if _, blocked := h.guard.byIdentifier.Blocked(loginKey(LoginIdentifier{Kind: IdentifierUsername, Value: "shaco"})); blocked {
		t.Error("sem vaga de bcrypt a tentativa não deveria contar")
	}
	if n := h.guard.byIdentifier.Len(); n != 1 {
		t.Errorf("reservas guardadas = %d, want 1 (só nicccls)", n)
	}
}

// A-I2: corpo grande é recusado antes de virar memória; identificador longo
// é inválido e nem chega no limitador por identificador.
func TestLoginBodyAndIdentifierAreCapped(t *testing.T) {
	logins := &fakeLogins{}
	h, cc := testHandler(logins)
	router := loginRouter(h)

	huge := `{"login":"` + strings.Repeat("a", maxLoginBodyBytes) + `","password":"x"}`
	if w := postLogin(router, "198.51.100.1", huge); w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("corpo de %d bytes: status = %d, want 413", len(huge), w.Code)
	}

	long := `{"login":"` + strings.Repeat("a", maxIdentifierBytes+1) + `","password":"x"}`
	w := postLogin(router, "198.51.100.1", long)
	if w.Code != http.StatusUnauthorized || !strings.Contains(w.Body.String(), "invalid credentials") {
		t.Fatalf("identificador longo: %d %s, want 401 genérico", w.Code, w.Body.String())
	}
	if logins.calls.Load() != 0 || cc.calls.Load() != 0 {
		t.Error("identificador longo não pode procurar conta nem gastar bcrypt")
	}
	if n := h.guard.byIdentifier.Len(); n != 0 {
		t.Errorf("identificador longo entrou no limitador (%d chaves)", n)
	}
	if n := h.guard.byIP.Len(); n != 1 {
		t.Errorf("as tentativas deveriam contar no IP (%d chaves)", n)
	}

	reg := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/register", strings.NewReader(huge))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(reg, req)
	if reg.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("register com corpo grande: status = %d, want 413", reg.Code)
	}
}

func TestLoginRejectsPasswordOver72BytesWithoutBcrypt(t *testing.T) {
	logins := &fakeLogins{user: &user.User{ID: "u1", Username: "nicccls", PasswordHash: "x"}}
	h, cc := testHandler(logins)
	router := loginRouter(h)
	w := postLogin(router, "198.51.100.1", `{"login":"nicccls","password":"`+strings.Repeat("a", 73)+`"}`)
	if w.Code != http.StatusUnauthorized || !strings.Contains(w.Body.String(), "invalid credentials") {
		t.Fatalf("senha de 73 bytes: %d %s, want 401 genérico", w.Code, w.Body.String())
	}
	if cc.calls.Load() != 0 || logins.calls.Load() != 0 {
		t.Error("senha longa não pode procurar conta nem gastar bcrypt")
	}
}

// Um panic no compare (recuperado pelo gin.Recovery) não pode vazar a vaga.
func TestLoginPanicInCompareReleasesBcryptSlot(t *testing.T) {
	logins := &fakeLogins{user: &user.User{ID: "u1", Username: "nicccls", PasswordHash: "x"}}
	h, _ := testHandler(logins)
	h.guard.bcryptSlots = make(chan struct{}, 1)
	h.compareHash = func(_, _ []byte) error { panic("boom") }
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	AuthRoutes(router.Group(""), h, func(c *gin.Context) { c.Next() })

	w := postLogin(router, "198.51.100.1", `{"login":"nicccls","password":"x"}`)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 do Recovery", w.Code)
	}
	if got := len(h.guard.bcryptSlots); got != 0 {
		t.Errorf("%d vagas presas após o panic, want 0", got)
	}
}
