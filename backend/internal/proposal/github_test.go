package proposal

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGitHubClientCreateIssue(t *testing.T) {
	var gotPath, gotAuth string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotAuth = r.URL.Path, r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"number":42,"html_url":"https://github.com/o/r/issues/42"}`))
	}))
	defer srv.Close()

	g := NewGitHubClient("tok", "o/r")
	g.base = srv.URL
	n, url, err := g.CreateIssue(context.Background(), Proposal{
		Title: "Modo claro", Description: "Tema claro.", AuthorName: "Beto", YesVotes: 2, NoVotes: 1,
	})
	if err != nil || n != 42 || url != "https://github.com/o/r/issues/42" {
		t.Fatalf("got %d %q %v", n, url, err)
	}
	if gotPath != "/repos/o/r/issues" || gotAuth != "Bearer tok" {
		t.Fatalf("requisição errada: %s %q", gotPath, gotAuth)
	}
	body, _ := gotBody["body"].(string)
	if gotBody["title"] != "Modo claro" || !strings.Contains(body, "Beto") || !strings.Contains(body, "2 sim, 1 não") {
		t.Fatalf("corpo da issue: %v", gotBody)
	}
}

func TestGitHubClientErrorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"Bad credentials"}`))
	}))
	defer srv.Close()

	g := NewGitHubClient("ruim", "o/r")
	g.base = srv.URL
	if _, _, err := g.CreateIssue(context.Background(), Proposal{Title: "x"}); err == nil ||
		!strings.Contains(err.Error(), "401") {
		t.Fatalf("esperava erro 401, veio %v", err)
	}
}
