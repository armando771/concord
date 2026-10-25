package conversation

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// User-Agent padrão do Electron: traz "<productName>/<versão>" do app.
const (
	uaDesktop0612 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Salinha/0.6.12 Chrome/140.0.0.0 Electron/38.0.0 Safari/537.36"
	uaDesktop0615 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Salinha/0.6.15 Chrome/140.0.0.0 Electron/38.0.0 Safari/537.36"
	uaBrowser     = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)

// listFixture: uma DM 1:1 e um grupo, como o ListByUserID do repositório
// monta (other_user só na DM).
func listFixture() []Summary {
	ana := OtherUser{ID: "ana", Username: "ana", DisplayName: "Ana"}
	bia := OtherUser{ID: "bia", Username: "bia", DisplayName: "Bia"}
	caio := OtherUser{ID: "caio", Username: "caio", DisplayName: "Caio"}
	return []Summary{
		{
			Conversation: Conversation{ID: "dm1", Type: TypeDM, UserAID: "ana", UserBID: "bia"},
			OtherUser:    &bia,
			Members:      []OtherUser{ana, bia},
		},
		{
			Conversation: Conversation{ID: "g1", Type: TypeGroup, Name: "Galera"},
			Members:      []OtherUser{ana, bia, caio},
		},
	}
}

func listAs(t *testing.T, target string, userAgent string) []map[string]any {
	t.Helper()
	gin.SetMode(gin.TestMode)
	store := newFakeStore()
	store.list = listFixture()
	h := &Handler{service: &Service{repository: store}}

	r := gin.New()
	r.GET("/conversations", func(c *gin.Context) { c.Set("userID", "ana") }, h.List)

	req := httptest.NewRequest(http.MethodGet, target, nil)
	if userAgent != "" {
		req.Header.Set("User-Agent", userAgent)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var out []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func ids(rows []map[string]any) []string {
	out := []string{}
	for _, r := range rows {
		out = append(out, r["id"].(string))
	}
	return out
}

// O app 0.6.12 faz conv.other_user.id em toda linha da lista: um grupo (sem
// other_user) derrubava a tela inteira. Para ele, só as DMs 1:1.
func TestListOldDesktopGetsOnlyRowsWithOtherUser(t *testing.T) {
	rows := listAs(t, "/conversations", uaDesktop0612)
	for _, r := range rows {
		other, ok := r["other_user"].(map[string]any)
		if !ok || other["id"] == nil {
			t.Fatalf("linha %v sem other_user.id: o app antigo quebra", r["id"])
		}
	}
	if got := ids(rows); len(got) != 1 || got[0] != "dm1" {
		t.Fatalf("esperava só a DM, veio %v", got)
	}
}

// Quem já entende grupo continua recebendo tudo.
func TestListGroupAwareClientsGetGroups(t *testing.T) {
	cases := map[string]struct{ target, ua string }{
		"app 0.6.15":            {"/conversations", uaDesktop0615},
		"navegador (app web)":   {"/conversations", uaBrowser},
		"sem user-agent":        {"/conversations", ""},
		"opt-in explícito":      {"/conversations?include_groups=1", uaDesktop0612},
		"dev com versão 0.6.0":  {"/conversations?include_groups=1", "Salinha/0.6.0 Electron/38.0.0"},
		"user-agent malformado": {"/conversations", "Salinha/abc Electron/38"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			if got := ids(listAs(t, tc.target, tc.ua)); len(got) != 2 {
				t.Fatalf("esperava DM e grupo, veio %v", got)
			}
		})
	}
}

func TestLegacyDesktopVersion(t *testing.T) {
	cases := map[string]bool{
		uaDesktop0612: true,
		uaDesktop0615: false,
		uaBrowser:     false,
		"":            false,
		"Mozilla/5.0 (KHTML, like Gecko) concord/0.5.3 Chrome/1 Electron/30.0.0":  true,
		"Mozilla/5.0 (KHTML, like Gecko) Salinha/0.6.14 Chrome/1 Electron/30.0.0": true,
		"Mozilla/5.0 (KHTML, like Gecko) Salinha/0.7.0 Chrome/1 Electron/30.0.0":  false,
		"Mozilla/5.0 (KHTML, like Gecko) Salinha/1.0.0 Chrome/1 Electron/30.0.0":  false,
		// Sem "Electron/": não é o app desktop.
		"Salinha/0.6.12": false,
	}
	for ua, want := range cases {
		if got := legacyDesktopWithoutGroups(ua); got != want {
			t.Errorf("legacyDesktopWithoutGroups(%q) = %v, quer %v", ua, got, want)
		}
	}
}
