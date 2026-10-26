package clientip

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestTrustedProxies(t *testing.T) {
	cases := []struct {
		name, host, env string
		want            []string
	}{
		{"atrás do Caddy (HOST local)", "127.0.0.1", "", []string{"127.0.0.1", "::1"}},
		{"HOST localhost", "localhost", "", []string{"127.0.0.1", "::1"}},
		{"HOST ::1", "::1", "", []string{"127.0.0.1", "::1"}},
		{"exposto direto (playit/LAN)", "", "", nil},
		{"exposto em IP da LAN", "192.168.0.10", "", nil},
		{"lista explícita", "", " 10.0.0.1, 10.0.0.0/8 ,", []string{"10.0.0.1", "10.0.0.0/8"}},
		{"explícita vence o HOST", "127.0.0.1", "10.0.0.1", []string{"10.0.0.1"}},
		{"none desliga", "127.0.0.1", "none", nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := TrustedProxies(c.host, c.env); !reflect.DeepEqual(got, c.want) {
				t.Errorf("TrustedProxies(%q, %q) = %v, want %v", c.host, c.env, got, c.want)
			}
		})
	}
}

func clientIPOf(t *testing.T, proxies []string, remoteAddr string, headers map[string]string) string {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	if err := Configure(router, proxies); err != nil {
		t.Fatal(err)
	}
	var got string
	router.GET("/", func(c *gin.Context) { got = c.ClientIP() })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = remoteAddr
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	router.ServeHTTP(httptest.NewRecorder(), req)
	return got
}

func TestConfigureBehindCaddy(t *testing.T) {
	loopback := []string{"127.0.0.1", "::1"}
	// O Caddy (sem trusted_proxies próprio) troca o X-Forwarded-For pelo IP real.
	if ip := clientIPOf(t, loopback, "127.0.0.1:5000", map[string]string{"X-Forwarded-For": "203.0.113.7"}); ip != "203.0.113.7" {
		t.Errorf("via Caddy: %q, want 203.0.113.7", ip)
	}
	// Mesmo que algo chegue com uma lista, vale o último IP não confiável.
	if ip := clientIPOf(t, loopback, "127.0.0.1:5000", map[string]string{"X-Forwarded-For": "6.6.6.6, 203.0.113.7"}); ip != "203.0.113.7" {
		t.Errorf("lista no XFF: %q, want 203.0.113.7", ip)
	}
	// Quem fala direto com o backend não escolhe o próprio IP.
	if ip := clientIPOf(t, loopback, "198.51.100.9:5000", map[string]string{"X-Forwarded-For": "6.6.6.6"}); ip != "198.51.100.9" {
		t.Errorf("direto com XFF falso: %q, want 198.51.100.9", ip)
	}
	// X-Real-IP não é usado (o Caddy não manda; seria só mais um jeito de forjar).
	if ip := clientIPOf(t, loopback, "127.0.0.1:5000", map[string]string{"X-Real-IP": "6.6.6.6"}); ip != "127.0.0.1" {
		t.Errorf("X-Real-IP: %q, want 127.0.0.1", ip)
	}
}

func TestConfigureWithoutProxy(t *testing.T) {
	// playit/LAN: o túnel entrega pelo loopback, mas o cabeçalho vem do cliente.
	if ip := clientIPOf(t, nil, "127.0.0.1:5000", map[string]string{"X-Forwarded-For": "6.6.6.6"}); ip != "127.0.0.1" {
		t.Errorf("sem proxy confiável: %q, want 127.0.0.1", ip)
	}
}
