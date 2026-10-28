package serverlevel

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

type fakeMembers struct{ member bool }

func (f fakeMembers) IsMember(context.Context, string, string) (bool, error) { return f.member, nil }

type fakeDetailer struct{ err error }

func (f fakeDetailer) Detail(_ context.Context, serverID string) (Detail, error) {
	return Detail{Progress: newProgress(serverID, 300), Week: []SourceXP{{SourceVoice, 30}}}, f.err
}

const testServer = "6f1c1b7e-8a5e-4a51-9f2a-111111111111"

func getLevel(t *testing.T, h *Handler, serverID string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	auth := func(c *gin.Context) { c.Set("userID", "ana") }
	Routes(r.Group("/api"), h, auth)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/servers/"+serverID+"/level", nil))
	return w
}

func TestHandlerGet(t *testing.T) {
	tests := []struct {
		name     string
		serverID string
		member   bool
		err      error
		want     int
	}{
		{"membro vê o nível", testServer, true, nil, http.StatusOK},
		{"quem não é membro não vê", testServer, false, nil, http.StatusForbidden},
		{"id inválido", "abc", true, nil, http.StatusBadRequest},
		{"banco fora", testServer, true, errors.New("x"), http.StatusInternalServerError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := getLevel(t, NewHandler(fakeDetailer{tt.err}, fakeMembers{tt.member}), tt.serverID)
			if w.Code != tt.want {
				t.Fatalf("status = %d, quer %d (%s)", w.Code, tt.want, w.Body)
			}
		})
	}
}

func TestHandlerGetDevolveProgressoESemana(t *testing.T) {
	w := getLevel(t, NewHandler(fakeDetailer{}, fakeMembers{true}), testServer)
	var got Detail
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ServerID != testServer || got.Level != 2 || got.XPIntoLevel != 50 || got.Week[0].XP != 30 {
		t.Errorf("resposta = %+v", got)
	}
}
