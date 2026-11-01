package enquete

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
	pendentes []Enquete
	resposta  Resposta
	err       error
	// recebeu guarda o que o handler pediu ao serviço.
	recebeuEnquete, recebeuOpcao string
}

func (f *fakeSource) Pendentes(context.Context, string) ([]Enquete, error) {
	return f.pendentes, f.err
}

func (f *fakeSource) Responder(_ context.Context, _, enquete, opcao string) (Resposta, error) {
	f.recebeuEnquete, f.recebeuOpcao = enquete, opcao
	return f.resposta, f.err
}

func chamar(src enqueteSource, viewer, metodo, caminho, corpo string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	auth := func(c *gin.Context) {
		if viewer != "" {
			c.Set("userID", viewer)
		}
		c.Next()
	}
	EnqueteRoutes(r.Group("/api"), &Handler{service: src}, auth)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(metodo, caminho, strings.NewReader(corpo))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func TestHandlerGetDevolveAsPendentes(t *testing.T) {
	src := &fakeSource{pendentes: []Enquete{{ID: "teste", Titulo: "T", Descricao: "D", Opcoes: []Opcao{{ID: "a", Rotulo: "A", Badge: "b"}, {ID: "n", Rotulo: "N"}}}}}
	w := chamar(src, "ana", http.MethodGet, "/api/users/me/enquetes", "")
	quer := `{"enquetes":[{"id":"teste","titulo":"T","descricao":"D","opcoes":[{"id":"a","rotulo":"A","badge":"b"},{"id":"n","rotulo":"N"}]}]}`
	if w.Code != http.StatusOK || strings.TrimSpace(w.Body.String()) != quer {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}

func TestHandlerGetSemPendentesDevolveListaVazia(t *testing.T) {
	w := chamar(&fakeSource{pendentes: []Enquete{}}, "ana", http.MethodGet, "/api/users/me/enquetes", "")
	if w.Code != http.StatusOK || strings.TrimSpace(w.Body.String()) != `{"enquetes":[]}` {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}

func TestHandlerPostPassaAEnqueteEAOpcao(t *testing.T) {
	src := &fakeSource{resposta: Resposta{Enquete: "teste", Opcao: "a", Badge: "b"}}
	w := chamar(src, "ana", http.MethodPost, "/api/users/me/enquetes/teste", `{"opcao":"a"}`)
	if w.Code != http.StatusOK || src.recebeuEnquete != "teste" || src.recebeuOpcao != "a" {
		t.Fatalf("status = %d, recebeu = %q/%q", w.Code, src.recebeuEnquete, src.recebeuOpcao)
	}
	if strings.TrimSpace(w.Body.String()) != `{"enquete":"teste","opcao":"a","badge":"b"}` {
		t.Fatalf("body = %s", w.Body.String())
	}
}

func TestHandlerStatusDosErros(t *testing.T) {
	casos := []struct {
		nome, viewer, metodo, caminho, corpo string
		erro                                 error
		status                               int
	}{
		{"sem login no GET", "", http.MethodGet, "/api/users/me/enquetes", "", nil, http.StatusUnauthorized},
		{"sem login no POST", "", http.MethodPost, "/api/users/me/enquetes/x", `{"opcao":"a"}`, nil, http.StatusUnauthorized},
		{"corpo vazio", "ana", http.MethodPost, "/api/users/me/enquetes/x", ``, nil, http.StatusBadRequest},
		{"sem a opção", "ana", http.MethodPost, "/api/users/me/enquetes/x", `{}`, nil, http.StatusBadRequest},
		{"opção em branco", "ana", http.MethodPost, "/api/users/me/enquetes/x", `{"opcao":""}`, nil, http.StatusBadRequest},
		{"opção inválida", "ana", http.MethodPost, "/api/users/me/enquetes/x", `{"opcao":"z"}`, ErrOpcaoInvalida, http.StatusBadRequest},
		{"fora do corte", "ana", http.MethodPost, "/api/users/me/enquetes/x", `{"opcao":"a"}`, ErrNaoElegivel, http.StatusForbidden},
		{"já respondeu", "ana", http.MethodPost, "/api/users/me/enquetes/x", `{"opcao":"a"}`, ErrJaRespondeu, http.StatusConflict},
		{"enquete inexistente", "ana", http.MethodPost, "/api/users/me/enquetes/x", `{"opcao":"a"}`, ErrEnqueteInexistente, http.StatusNotFound},
		{"usuário sumiu", "ana", http.MethodGet, "/api/users/me/enquetes", "", ErrUsuarioNaoEncontrado, http.StatusNotFound},
		{"falha do banco", "ana", http.MethodPost, "/api/users/me/enquetes/x", `{"opcao":"a"}`, errors.New("db down"), http.StatusInternalServerError},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			w := chamar(&fakeSource{err: c.erro}, c.viewer, c.metodo, c.caminho, c.corpo)
			if w.Code != c.status {
				t.Fatalf("status = %d, quer %d (%s)", w.Code, c.status, w.Body.String())
			}
		})
	}
}
