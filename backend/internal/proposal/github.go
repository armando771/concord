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
	token string
	repo  string // owner/repo
	http  *http.Client
	base  string
}

func NewGitHubClient(token, repo string) *GitHubClient {
	return &GitHubClient{
		token: token,
		repo:  repo,
		http:  &http.Client{Timeout: 15 * time.Second},
		base:  "https://api.github.com",
	}
}

func (g *GitHubClient) CreateIssue(ctx context.Context, p Proposal) (int, string, error) {
	body, err := json.Marshal(map[string]any{
		"title":  p.Title,
		"body":   issueBody(p),
		"labels": []string{"proposta"},
	})
	if err != nil {
		return 0, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.base+"/repos/"+g.repo+"/issues", bytes.NewReader(body))
	if err != nil {
		return 0, "", err
	}
	req.Header.Set("Authorization", "Bearer "+g.token)
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

func issueBody(p Proposal) string {
	desc := strings.TrimSpace(p.Description)
	if desc == "" {
		desc = "_Sem descrição._"
	}
	return fmt.Sprintf(
		"%s\n\n---\nProposta de **%s**, aprovada na votação da comunidade: %d sim, %d não.",
		desc, p.AuthorName, p.YesVotes, p.NoVotes,
	)
}
