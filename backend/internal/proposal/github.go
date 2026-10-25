package proposal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// IssueCreator abre a issue de uma proposta aprovada.
type IssueCreator interface {
	CreateIssue(ctx context.Context, p Proposal) (number int, url string, err error)
}

// GitHubClient cria issues pela API REST (POST /repos/{owner}/{repo}/issues).
type GitHubClient struct {
	tokens tokenSource
	repo   string // owner/repo
	http   *http.Client
	base   string
	// publicURL é o endereço público do backend (API_PUBLIC_URL): as imagens do
	// card entram na issue como link absoluto. Vazio: a issue sai sem imagens.
	publicURL string
}

// NewGitHubClient usa um token fixo (pessoal ou de uma conta robô). Para criar
// as issues como um GitHub App, veja NewGitHubAppClient.
func NewGitHubClient(token, repo string) *GitHubClient {
	return &GitHubClient{
		tokens: staticToken(token),
		repo:   repo,
		http:   &http.Client{Timeout: 15 * time.Second},
		base:   "https://api.github.com",
	}
}

// WithBaseURL aponta o cliente para outra API (GitHub Enterprise ou um servidor
// de teste), tanto para criar issues quanto para pedir o token do App.
func (g *GitHubClient) WithBaseURL(url string) *GitHubClient {
	g.base = strings.TrimRight(url, "/")
	if app, ok := g.tokens.(*appTokens); ok {
		app.base = g.base
	}
	return g
}

// WithPublicURL informa onde o GitHub consegue buscar as imagens das propostas.
func (g *GitHubClient) WithPublicURL(url string) *GitHubClient {
	g.publicURL = strings.TrimRight(url, "/")
	return g
}

func (g *GitHubClient) CreateIssue(ctx context.Context, p Proposal) (int, string, error) {
	token, err := g.tokens.Token(ctx)
	if err != nil {
		return 0, "", err
	}
	body, err := json.Marshal(map[string]any{
		"title":  p.Title,
		"body":   issueBody(p, g.publicURL),
		"labels": []string{"proposta"},
	})
	if err != nil {
		return 0, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.base+"/repos/"+g.repo+"/issues", bytes.NewReader(body))
	if err != nil {
		return 0, "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Content-Type", "application/json")

	res, err := g.http.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode != http.StatusCreated {
		if res.StatusCode == http.StatusUnauthorized {
			// Token de instalação revogado/expirado: a próxima tentativa pede outro.
			g.tokens.Invalidate()
		}
		return 0, "", fmt.Errorf("github: status %d: %s", res.StatusCode, strings.TrimSpace(string(raw)))
	}
	var out struct {
		Number  int    `json:"number"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return 0, "", err
	}
	return out.Number, out.HTMLURL, nil
}

func issueBody(p Proposal, publicURL string) string {
	desc := strings.TrimSpace(p.Description)
	if desc == "" {
		desc = "_Sem descrição._"
	}
	var images strings.Builder
	if publicURL != "" {
		for i, img := range p.Images {
			fmt.Fprintf(&images, "\n\n![Imagem %d](%s%s)", i+1, publicURL, img.URL)
		}
	}
	return fmt.Sprintf(
		"%s%s\n\n---\nProposta de **%s**, aprovada na votação da comunidade: %d sim, %d não.",
		desc, images.String(), p.AuthorName, p.YesVotes, p.NoVotes,
	)
}
