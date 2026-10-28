package badge

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

const (
	ownerID = "00000000-0000-0000-0000-000000000001"
	otherID = "00000000-0000-0000-0000-000000000009"
)

func serve(t *testing.T, src badgeSource, path string, viewer string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	auth := func(c *gin.Context) {
		if viewer != "" {
			c.Set("userID", viewer)
		}
		c.Next()
	}
	BadgeRoutes(r.Group("/api"), &Handler{service: src}, auth)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w
}

func serviceWithOwner() *Service {
	s, st, _, _, _ := newTestService()
	st.stats[ownerID] = Stats{CreatedAt: now.AddDate(0, -2, 0), MessagesSent: 2345, OwnedServers: 2}
	return s
}

func TestHandlerOwnerGetsTheFullView(t *testing.T) {
	w := serve(t, serviceWithOwner(), "/api/users/"+ownerID+"/badges", ownerID)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var res struct {
		Self   bool    `json:"self"`
		Badges []Badge `json:"badges"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	// Só o que já tem o tier 1 aparece (nada de categoria bloqueada).
	if !res.Self || len(res.Badges) == 0 || hasBadge(res.Badges, "festeiro") {
		t.Fatalf("owner body = %s", w.Body.String())
	}
	if msgs := find(t, res.Badges, "mensagens"); msgs.Value != 2345 || msgs.NextThreshold == nil {
		t.Fatalf("owner mensagens = %+v", msgs)
	}
}

// Dono do perfil vê o que falta (próximo tier e progresso) nas categorias que
// já conquistou; as que não têm o tier 1 nem aparecem.
func TestHandlerOwnerSeesProgressOnlyOfEarnedCategories(t *testing.T) {
	w := serve(t, serviceWithOwner(), "/api/users/"+ownerID+"/badges", ownerID)
	var res struct {
		Badges []map[string]any `json:"badges"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if len(res.Badges) == 0 {
		t.Fatalf("sem badges: %s", w.Body.String())
	}
	for _, b := range res.Badges {
		if tier, _ := b["tier"].(float64); tier < 1 {
			t.Fatalf("categoria sem tier 1 saiu: %v", b)
		}
		if _, ok := b["progress"]; !ok {
			t.Fatalf("progresso faltando: %v", b)
		}
	}
}

func TestHandlerOthersGetThePublicView(t *testing.T) {
	w := serve(t, serviceWithOwner(), "/api/users/"+ownerID+"/badges", otherID)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var res struct {
		Self   bool             `json:"self"`
		Badges []map[string]any `json:"badges"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.Self {
		t.Fatal("public view marked as self")
	}
	for _, b := range res.Badges {
		if _, ok := b["value"]; ok {
			t.Fatalf("value leaked: %v", b)
		}
		if _, ok := b["progress"]; ok {
			t.Fatalf("progress leaked: %v", b)
		}
		if b["category"] == "dono" && b["tier_name"] != "Anfitrião" {
			t.Fatalf("dono = %v", b)
		}
	}
}

func TestHandlerOthersSeeTheDevBadgeWithoutNumbers(t *testing.T) {
	s, st, _, _, _ := newTestService()
	st.stats[ownerID] = Stats{CreatedAt: now.AddDate(0, -2, 0), IsDev: true}
	w := serve(t, s, "/api/users/"+ownerID+"/badges", otherID)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var res struct {
		Badges []map[string]any `json:"badges"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	var dev map[string]any
	for _, b := range res.Badges {
		if b["category"] == "criador" {
			dev = b
		}
	}
	if dev == nil || dev["rarity"] != RarityMythic || dev["tier_name"] != "Fundador" {
		t.Fatalf("criador = %v (body %s)", dev, w.Body.String())
	}
	for _, k := range []string{"value", "progress", "next_threshold", "obtainable", "is_dev"} {
		if _, ok := dev[k]; ok {
			t.Fatalf("%s leaked: %v", k, dev)
		}
	}
	if day, _ := dev["unlocked_at"].(string); len(day) != len("2006-01-02") {
		t.Fatalf("unlocked_at = %q, want only the day", day)
	}
}

func TestHandlerRejectsBadIDsAndUnknownUsers(t *testing.T) {
	s := serviceWithOwner()
	if w := serve(t, s, "/api/users/nope/badges", otherID); w.Code != http.StatusNotFound {
		t.Fatalf("bad id status = %d", w.Code)
	}
	if w := serve(t, s, "/api/users/00000000-0000-0000-0000-000000000002/badges", otherID); w.Code != http.StatusNotFound {
		t.Fatalf("unknown user status = %d", w.Code)
	}
	if w := serve(t, s, "/api/users/"+ownerID+"/badges", ""); w.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status = %d", w.Code)
	}
}
