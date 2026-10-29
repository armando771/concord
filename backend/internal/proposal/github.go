package proposal

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// IssueCreator abre a issue de uma proposta aprovada.
type IssueCreator interface {
	CreateIssue(ctx context.Context, p Proposal) (number int, url string, err error)
}

// IssueUpdater deixa a issue como o card pede: aberta ou fechada (concluída ou
// "não planejada") e com quem está fazendo como assignee (nil = ninguém).
// assigneeApplied é false quando o GitHub recusou o assignee (login que não
// existe ou sem acesso ao repositório): o estado foi aplicado mesmo assim.
type IssueUpdater interface {
	UpdateIssue(ctx context.Context, number int, state string, assignee *string) (assigneeApplied bool, err error)
}

// ErrGitHubRateLimited: o limite da API acabou; nada é chamado antes do reset.
var ErrGitHubRateLimited = errors.New("github: limite da API")

// RateLimitError diz até quando esperar o limite da API do GitHub resetar.
type RateLimitError struct{ Until time.Time }

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("github: limite da API até %s", e.Until.Format(time.RFC3339))
}

func (e *RateLimitError) Is(target error) bool { return target == ErrGitHubRateLimited }

// secondaryLimitWait: espera do limite secundário quando o GitHub não diz quanto.
const secondaryLimitWait = time.Minute

// GitHubClient cria e atualiza issues pela API REST (/repos/{owner}/{repo}/issues).
type GitHubClient struct {
	tokens tokenSource
	repo   string // owner/repo
	http   *http.Client
	base   string
	// publicURL é o endereço público do backend (API_PUBLIC_URL): as imagens do
	// card entram na issue como link absoluto. Vazio: a issue sai sem imagens.
	publicURL string
	now       func() time.Time

	mu sync.Mutex
	// blockedUntil: o limite da API acabou; até lá nenhuma chamada sai.
	blockedUntil time.Time
}

// NewGitHubClient usa um token fixo (pessoal ou de uma conta robô). Para criar
// as issues como um GitHub App, veja NewGitHubAppClient.
func NewGitHubClient(token, repo string) *GitHubClient {
	return &GitHubClient{
		tokens: staticToken(token),
		repo:   repo,
		http:   &http.Client{Timeout: 15 * time.Second},
		base:   "https://api.github.com",
		now:    time.Now,
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

// statusError é uma resposta do GitHub fora do esperado.
type statusError struct {
	status int
	body   string
}

func (e *statusError) Error() string { return fmt.Sprintf("github: status %d: %s", e.status, e.body) }

// call faz a requisição autenticada. Com o limite da API esgotado (antes ou
// nesta resposta) devolve *RateLimitError sem chamar até o reset.
func (g *GitHubClient) call(ctx context.Context, method, path string, payload any, want int) ([]byte, error) {
	g.mu.Lock()
	until := g.blockedUntil
	g.mu.Unlock()
	if g.now().Before(until) {
		return nil, &RateLimitError{Until: until}
	}
	token, err := g.tokens.Token(ctx)
	if err != nil {
		return nil, err
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, method, g.base+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Content-Type", "application/json")

	res, err := g.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode == want {
		return raw, nil
	}
	if until, limited := rateLimitUntil(res, raw, g.now()); limited {
		g.mu.Lock()
		if until.After(g.blockedUntil) {
			g.blockedUntil = until
		}
		g.mu.Unlock()
		return nil, &RateLimitError{Until: until}
	}
	if res.StatusCode == http.StatusUnauthorized {
		// Token de instalação revogado/expirado: a próxima tentativa pede outro.
		g.tokens.Invalidate()
	}
	return nil, &statusError{status: res.StatusCode, body: strings.TrimSpace(string(raw))}
}

// rateLimitUntil reconhece o limite da API: primário (403/429 com
// X-RateLimit-Remaining: 0, espera até X-RateLimit-Reset) ou secundário
// (Retry-After em segundos, ou a mensagem sem cabeçalho: espera um minuto).
func rateLimitUntil(res *http.Response, body []byte, now time.Time) (time.Time, bool) {
	if res.StatusCode != http.StatusForbidden && res.StatusCode != http.StatusTooManyRequests {
		return time.Time{}, false
	}
	if s := res.Header.Get("Retry-After"); s != "" {
		if secs, err := strconv.Atoi(strings.TrimSpace(s)); err == nil && secs >= 0 {
			return now.Add(time.Duration(secs) * time.Second), true
		}
	}
	if res.Header.Get("X-RateLimit-Remaining") == "0" {
		if reset, err := strconv.ParseInt(res.Header.Get("X-RateLimit-Reset"), 10, 64); err == nil {
			if until := time.Unix(reset, 0); until.After(now) {
				return until, true
			}
		}
		return now.Add(secondaryLimitWait), true
	}
	if res.StatusCode == http.StatusTooManyRequests ||
		strings.Contains(strings.ToLower(string(body)), "rate limit") {
		return now.Add(secondaryLimitWait), true
	}
	return time.Time{}, false
}

func (g *GitHubClient) CreateIssue(ctx context.Context, p Proposal) (int, string, error) {
	raw, err := g.call(ctx, http.MethodPost, "/repos/"+g.repo+"/issues", map[string]any{
		"title":  p.Title,
		"body":   issueBody(p, g.publicURL),
		"labels": []string{"proposta"},
	}, http.StatusCreated)
	if err != nil {
		return 0, "", err
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

// issueStatePayload traduz o estado guardado para o PATCH da issue.
func issueStatePayload(state string) map[string]any {
	switch state {
	case IssueCompleted:
		return map[string]any{"state": "closed", "state_reason": "completed"}
	case IssueNotPlanned:
		return map[string]any{"state": "closed", "state_reason": "not_planned"}
	}
	return map[string]any{"state": "open"}
}

// UpdateIssue aplica estado e assignee. Se o GitHub recusar o assignee (422),
// aplica só o estado e devolve assigneeApplied = false.
func (g *GitHubClient) UpdateIssue(ctx context.Context, number int, state string, assignee *string) (bool, error) {
	path := fmt.Sprintf("/repos/%s/issues/%d", g.repo, number)
	payload := issueStatePayload(state)
	payload["assignees"] = []string{}
	if assignee != nil {
		payload["assignees"] = []string{*assignee}
	}
	_, err := g.call(ctx, http.MethodPatch, path, payload, http.StatusOK)
	var se *statusError
	if errors.As(err, &se) && se.status == http.StatusUnprocessableEntity && assignee != nil {
		_, err = g.call(ctx, http.MethodPatch, path, issueStatePayload(state), http.StatusOK)
		return false, err
	}
	return err == nil, err
}

const (
	// issueMaxComments e issueCommentLen limitam a discussão que vai no corpo da issue.
	issueMaxComments = 10
	issueCommentLen  = 300
)

// brt: as datas da issue saem no horário de Brasília (sem horário de verão).
var brt = time.FixedZone("BRT", -3*60*60)

var (
	issueMention = regexp.MustCompile(`@([A-Za-z0-9_-])`)
	issueHTMLTag = regexp.MustCompile(`(?i)</?(details|summary)\b[^>]*>`)
)

// issueText deixa o texto vindo do app seguro para o corpo da issue: o @ ganha
// um caractere invisível (não notifica quem tem o mesmo login no GitHub) e as
// tags de <details> coladas pela pessoa não quebram o bloco da discussão.
func issueText(s string) string {
	s = issueHTMLTag.ReplaceAllString(s, "")
	return issueMention.ReplaceAllString(s, "@\u200b$1")
}

func issueDate(t time.Time) string { return t.In(brt).Format("02/01/2006") }

// issueCell tira o que quebra uma célula de tabela markdown.
func issueCell(s string) string {
	return strings.NewReplacer("|", `\|`, "\n", " ", "\r", " ").Replace(strings.TrimSpace(s))
}

// issueResult: como a votação acabou (prazo ou movida pelo time tech).
func issueResult(p Proposal) string {
	when := ""
	if p.ClosedAt != nil {
		when = " em " + issueDate(*p.ClosedAt)
	}
	if p.CloseReason != nil && *p.CloseReason == CloseManual {
		if p.ClosedByName != nil && *p.ClosedByName != "" {
			return "Movida pelo time (" + issueCell(issueText(*p.ClosedByName)) + ")" + when
		}
		return "Movida pelo time" + when
	}
	return "Prazo da votação encerrado" + when
}

func issueDiscussion(comments []Comment) string {
	if len(comments) == 0 {
		return ""
	}
	var b strings.Builder
	fmt.Fprintf(&b, "\n\n<details>\n<summary>Discussão no card (%d)</summary>\n", len(comments))
	for i, c := range comments {
		if i == issueMaxComments {
			fmt.Fprintf(&b, "\n_…e mais %d comentários no card._\n", len(comments)-issueMaxComments)
			break
		}
		body := strings.TrimSpace(issueText(c.Body))
		if r := []rune(body); len(r) > issueCommentLen {
			body = string(r[:issueCommentLen]) + "…"
		}
		if n := len(c.Attachments); n > 0 {
			body = strings.TrimSpace(body + fmt.Sprintf(" [%d anexo(s)]", n))
		}
		fmt.Fprintf(&b, "\n**%s** (%s):\n> %s\n", issueCell(issueText(c.AuthorName)), issueDate(c.CreatedAt),
			strings.ReplaceAll(body, "\n", "\n> "))
	}
	b.WriteString("\n</details>")
	return b.String()
}

// issueBody é o corpo da issue: descrição e imagens do card, um resumo (autor,
// datas, votação, como acabou) e a discussão dos comentários.
func issueBody(p Proposal, publicURL string) string {
	desc := strings.TrimSpace(issueText(p.Description))
	if desc == "" {
		desc = "_Sem descrição._"
	}
	var b strings.Builder
	b.WriteString(desc)
	if publicURL != "" {
		for i, img := range p.Images {
			fmt.Fprintf(&b, "\n\n![Imagem %d](%s%s)", i+1, publicURL, img.URL)
		}
	}

	votes := fmt.Sprintf("%d sim, %d não", p.YesVotes, p.NoVotes)
	if total := p.YesVotes + p.NoVotes; total > 0 {
		votes += fmt.Sprintf(" (%d%% a favor)", p.YesVotes*100/total)
	}
	b.WriteString("\n\n## Sobre a proposta\n\n| | |\n|---|---|\n")
	fmt.Fprintf(&b, "| Autor | %s |\n", issueCell(issueText(p.AuthorName)))
	fmt.Fprintf(&b, "| Aberta em | %s |\n", issueDate(p.CreatedAt))
	fmt.Fprintf(&b, "| Votação | %s |\n", votes)
	fmt.Fprintf(&b, "| Resultado | %s |\n", issueResult(p))
	fmt.Fprintf(&b, "| Comentários | %d |", p.CommentCount)
	if p.EditedAt != nil {
		fmt.Fprintf(&b, "\n| Editada em | %s |", issueDate(*p.EditedAt))
	}

	b.WriteString(issueDiscussion(p.Comments))
	b.WriteString("\n\n---\nCriada automaticamente a partir de uma proposta da comunidade.")
	return b.String()
}
