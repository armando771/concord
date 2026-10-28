package soundboard

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// fakeFavorites guarda os favoritos em memória (user -> ids, na ordem).
type fakeFavorites struct {
	sounds *fakeRepo
	byUser map[string][]string
	fail   error
}

func (f *fakeFavorites) ListFavorites(_ context.Context, userID string) ([]FavoriteSound, error) {
	if f.fail != nil {
		return nil, f.fail
	}
	out := make([]FavoriteSound, 0)
	for _, id := range f.byUser[userID] {
		if s, ok := f.sounds.sounds[id]; ok {
			out = append(out, FavoriteSound{Sound: s, ServerName: "Servidor " + s.ServerID})
		}
	}
	return out, nil
}

func (f *fakeFavorites) AddFavorite(_ context.Context, userID, soundID string, max int) error {
	for _, id := range f.byUser[userID] {
		if id == soundID {
			return nil
		}
	}
	if len(f.byUser[userID]) >= max {
		return ErrFavoritesFull
	}
	f.byUser[userID] = append(f.byUser[userID], soundID)
	return nil
}

func (f *fakeFavorites) RemoveFavorite(_ context.Context, userID, soundID string) error {
	kept := f.byUser[userID][:0]
	for _, id := range f.byUser[userID] {
		if id != soundID {
			kept = append(kept, id)
		}
	}
	f.byUser[userID] = kept
	return nil
}

const (
	somDoSrv1   = "11111111-1111-1111-1111-111111111111"
	somDeFora   = "22222222-2222-2222-2222-222222222222"
	somSumido   = "33333333-3333-3333-3333-333333333333"
	favUser     = "user-1"
	favOutsider = "outsider"
)

func setupFavorites(t *testing.T) (*gin.Engine, *FavoritesHandler, *fakeFavorites) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	repo := newFakeRepo()
	repo.sounds[somDoSrv1] = Sound{ID: somDoSrv1, ServerID: "srv-1", Name: "buzina"}
	repo.sounds[somDeFora] = Sound{ID: somDeFora, ServerID: "srv-2", Name: "corneta"}
	favs := &fakeFavorites{sounds: repo, byUser: map[string][]string{}}
	// fakeServers ignora o servidor: user-1 é membro "de tudo" menos do srv-2.
	srv := &membersByServer{members: map[string]bool{"srv-1:" + favUser: true}}
	h := NewFavoritesHandler(favs, repo, srv)

	r := gin.New()
	api := r.Group("/api")
	FavoriteRoutes(api, h, func(c *gin.Context) {
		if uid := c.GetHeader("X-User-ID"); uid != "" {
			c.Set("userID", uid)
		}
		c.Next()
	})
	return r, h, favs
}

type membersByServer struct{ members map[string]bool }

func (m *membersByServer) IsMember(_ context.Context, serverID, userID string) (bool, error) {
	return m.members[serverID+":"+userID], nil
}

func favRequest(t *testing.T, r *gin.Engine, method, path, user string) (*httptest.ResponseRecorder, []FavoriteSound) {
	t.Helper()
	req := httptest.NewRequest(method, "/api/users/me/soundboard-favorites"+path, nil)
	if user != "" {
		req.Header.Set("X-User-ID", user)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var list []FavoriteSound
	if w.Code == http.StatusOK {
		if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
			t.Fatalf("%s: %v", w.Body.String(), err)
		}
	}
	return w, list
}

func TestFavoriteAddListRemove(t *testing.T) {
	r, _, _ := setupFavorites(t)

	w, list := favRequest(t, r, http.MethodPut, "/"+somDoSrv1, favUser)
	if w.Code != http.StatusOK || len(list) != 1 || list[0].ID != somDoSrv1 || list[0].ServerName != "Servidor srv-1" {
		t.Fatalf("PUT = %d %s", w.Code, w.Body.String())
	}
	if w, list = favRequest(t, r, http.MethodGet, "", favUser); w.Code != http.StatusOK || len(list) != 1 {
		t.Fatalf("GET = %d %s", w.Code, w.Body.String())
	}
	if w, list = favRequest(t, r, http.MethodDelete, "/"+somDoSrv1, favUser); w.Code != http.StatusOK || len(list) != 0 {
		t.Fatalf("DELETE = %d %s", w.Code, w.Body.String())
	}
}

func TestFavoriteRefusals(t *testing.T) {
	r, h, favs := setupFavorites(t)
	cases := []struct {
		name, method, path, user string
		want                     int
	}{
		{"sem login", http.MethodGet, "", "", http.StatusUnauthorized},
		{"som que não existe", http.MethodPut, "/" + somSumido, favUser, http.StatusNotFound},
		// Só favorita quem vê o som (membro da origem); depois não precisa mais.
		{"som de servidor de que não é membro", http.MethodPut, "/" + somDeFora, favUser, http.StatusNotFound},
		{"de fora do servidor", http.MethodPut, "/" + somDoSrv1, favOutsider, http.StatusNotFound},
	}
	for _, tc := range cases {
		if w, _ := favRequest(t, r, tc.method, tc.path, tc.user); w.Code != tc.want {
			t.Errorf("%s: status = %d (%s), want %d", tc.name, w.Code, w.Body.String(), tc.want)
		}
	}

	h.max = 0
	if w, _ := favRequest(t, r, http.MethodPut, "/"+somDoSrv1, favUser); w.Code != http.StatusConflict {
		t.Errorf("cheio: status = %d, want 409", w.Code)
	}

	favs.fail = errors.New("banco fora")
	if w, _ := favRequest(t, r, http.MethodGet, "", favUser); w.Code != http.StatusInternalServerError {
		t.Errorf("erro no banco: status = %d, want 500", w.Code)
	}
}
