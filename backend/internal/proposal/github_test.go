package proposal

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
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

func TestGitHubClientUpdateIssue(t *testing.T) {
	var bodies []map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch || r.URL.Path != "/repos/o/r/issues/9" {
			t.Errorf("requisição errada: %s %s", r.Method, r.URL.Path)
		}
		var b map[string]any
		_ = json.NewDecoder(r.Body).Decode(&b)
		bodies = append(bodies, b)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()
	g := NewGitHubClient("tok", "o/r")
	g.base = srv.URL
	login := "dev"
	if ok, err := g.UpdateIssue(context.Background(), 9, IssueCompleted, &login); err != nil || !ok {
		t.Fatalf("got %v %v", ok, err)
	}
	if ok, err := g.UpdateIssue(context.Background(), 9, IssueOpen, nil); err != nil || !ok {
		t.Fatalf("got %v %v", ok, err)
	}
	b := bodies[0]
	if b["state"] != "closed" || b["state_reason"] != "completed" || b["assignees"].([]any)[0] != "dev" {
		t.Fatalf("fechar como concluída com assignee: %v", b)
	}
	if bodies[1]["state"] != "open" || len(bodies[1]["assignees"].([]any)) != 0 {
		t.Fatalf("reabrir sem assignee: %v", bodies[1])
	}
}

func TestGitHubClientAssigneeRejected(t *testing.T) {
	var calls int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var b map[string]any
		_ = json.NewDecoder(r.Body).Decode(&b)
		if _, has := b["assignees"]; has {
			w.WriteHeader(http.StatusUnprocessableEntity)
			_, _ = w.Write([]byte(`{"message":"Validation Failed"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	g := NewGitHubClient("tok", "o/r")
	g.base = srv.URL
	login := "sem-acesso"
	ok, err := g.UpdateIssue(context.Background(), 9, IssueNotPlanned, &login)
	if err != nil || ok || calls != 2 {
		t.Fatalf("login recusado: aplica só o estado (ok=%v err=%v calls=%d)", ok, err, calls)
	}
}

// O limite da API acabou: nenhuma chamada sai antes do reset; depois, continua.
func TestGitHubClientRateLimit(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	var calls int
	limited := true
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		if limited {
			w.Header().Set("X-RateLimit-Remaining", "0")
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(now.Add(10*time.Minute).Unix(), 10))
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"message":"API rate limit exceeded"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	g := NewGitHubClient("tok", "o/r")
	g.base = srv.URL
	g.now = func() time.Time { return now }

	_, err := g.UpdateIssue(context.Background(), 1, IssueOpen, nil)
	var rl *RateLimitError
	if !errors.As(err, &rl) || !rl.Until.Equal(now.Add(10*time.Minute)) || !errors.Is(err, ErrGitHubRateLimited) {
		t.Fatalf("esperava o limite até o reset, veio %v", err)
	}
	if _, err := g.UpdateIssue(context.Background(), 1, IssueOpen, nil); !errors.As(err, &rl) || calls != 1 {
		t.Fatalf("antes do reset não pode chamar (calls=%d, err=%v)", calls, err)
	}
	limited = false
	now = now.Add(11 * time.Minute)
	if _, err := g.UpdateIssue(context.Background(), 1, IssueOpen, nil); err != nil || calls != 2 {
		t.Fatalf("depois do reset continua (calls=%d, err=%v)", calls, err)
	}
}

func TestRateLimitUntil(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	res := func(status int, headers map[string]string) *http.Response {
		r := &http.Response{StatusCode: status, Header: http.Header{}}
		for k, v := range headers {
			r.Header.Set(k, v)
		}
		return r
	}
	if until, ok := rateLimitUntil(res(429, map[string]string{"Retry-After": "30"}), nil, now); !ok || !until.Equal(now.Add(30*time.Second)) {
		t.Fatalf("Retry-After: %v %v", until, ok)
	}
	if until, ok := rateLimitUntil(res(403, nil), []byte(`{"message":"You have exceeded a secondary rate limit"}`), now); !ok || !until.Equal(now.Add(time.Minute)) {
		t.Fatalf("limite secundário sem cabeçalho: %v %v", until, ok)
	}
	if _, ok := rateLimitUntil(res(403, nil), []byte(`{"message":"Resource not accessible"}`), now); ok {
		t.Fatal("403 de permissão não é limite")
	}
	if _, ok := rateLimitUntil(res(500, map[string]string{"Retry-After": "5"}), nil, now); ok {
		t.Fatal("500 não é limite")
	}
}

func TestIssueBodyImages(t *testing.T) {
	p := Proposal{
		Description: "Texto", AuthorName: "Ana",
		Images: []Image{{ID: "1", URL: "/api/proposal-media/1"}, {ID: "2", URL: "/api/proposal-media/2"}},
	}
	got := issueBody(p, "https://api.exemplo.com")
	for _, want := range []string{
		"![Imagem 1](https://api.exemplo.com/api/proposal-media/1)",
		"![Imagem 2](https://api.exemplo.com/api/proposal-media/2)",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("corpo sem %q:\n%s", want, got)
		}
	}
	if strings.Contains(issueBody(p, ""), "![Imagem") {
		t.Error("sem API_PUBLIC_URL a issue não pode ter imagens")
	}
}
