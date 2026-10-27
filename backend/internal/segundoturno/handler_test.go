package segundoturno

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type fakeSource struct {
	estado Estado
	err    error
	// recebeu guarda o que o handler pediu ao serviço.
	recebeu *bool
}

func (f *fakeSource) Estado(context.Context, string) (Estado, error) { return f.estado, f.err }

func (f *fakeSource) Responder(_ context.Context, _ string, fezOL bool) (Estado, error) {
	f.recebeu = &fezOL
	return f.estado, f.err
}

func chamar(src estadoSource, viewer, metodo, corpo string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	auth := func(c *gin.Context) {
		if viewer != "" {
			c.Set("userID", viewer)
		}
		c.Next()
	}
	SegundoTurnoRoutes(r.Group("/api"), &Handler{service: src}, auth)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(metodo, "/api/users/me/segundo-turno", strings.NewReader(corpo))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func TestHandlerGetDevolveOEstado(t *testing.T) {
	w := chamar(&fakeSource{estado: Estado{Elegivel: true}}, "ana", http.MethodGet, "")
	if w.Code != http.StatusOK || strings.TrimSpace(w.Body.String()) != `{"elegivel":true,"respondeu":false,"fez_o_l":false}` {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}

func TestHandlerPostPassaAResposta(t *testing.T) {
	src := &fakeSource{estado: Estado{Elegivel: true, Respondeu: true, FezOL: true}}
	w := chamar(src, "ana", http.MethodPost, `{"fez_o_l":true}`)
	if w.Code != http.StatusOK || src.recebeu == nil || !*src.recebeu {
		t.Fatalf("status = %d, recebeu = %v", w.Code, src.recebeu)
	}
	src = &fakeSource{}
	chamar(src, "ana", http.MethodPost, `{"fez_o_l":false}`)
	if src.recebeu == nil || *src.recebeu {
		t.Fatalf("o não precisa chegar como false: %v", src.recebeu)
	}
}

func TestHandlerStatusDosErros(t *testing.T) {
	casos := []struct {
		nome   string
		viewer string
		metodo string
		corpo  string
		erro   error
		status int
	}{
		{"sem login no GET", "", http.MethodGet, "", nil, http.StatusUnauthorized},
		{"sem login no POST", "", http.MethodPost, `{"fez_o_l":true}`, nil, http.StatusUnauthorized},
		{"corpo vazio", "ana", http.MethodPost, ``, nil, http.StatusBadRequest},
		{"sem o campo", "ana", http.MethodPost, `{}`, nil, http.StatusBadRequest},
		{"fora do corte", "ana", http.MethodPost, `{"fez_o_l":true}`, ErrNaoElegivel, http.StatusForbidden},
		{"já respondeu", "ana", http.MethodPost, `{"fez_o_l":true}`, ErrJaRespondeu, http.StatusConflict},
		{"usuário sumiu", "ana", http.MethodGet, "", ErrUsuarioNaoEncontrado, http.StatusNotFound},
		{"falha do banco", "ana", http.MethodPost, `{"fez_o_l":false}`, errors.New("db down"), http.StatusInternalServerError},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			w := chamar(&fakeSource{err: c.erro}, c.viewer, c.metodo, c.corpo)
			if w.Code != c.status {
				t.Fatalf("status = %d, quer %d (%s)", w.Code, c.status, w.Body.String())
			}
		})
	}
}
