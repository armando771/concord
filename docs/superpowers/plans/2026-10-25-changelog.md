# Changelog global Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/changelog`, acessível a todos pelo ServerRail, que lista por versão o que cada release trouxe (novidades e correções), alimentada pelo deploy e com o histórico retroativo.

**Architecture:** Pacote Go `internal/changelog` (tabelas `changelog_releases`/`changelog_entries`, `GET /api/changelog` autenticado, `PUT /api/changelog/:version` protegido por token de CI e idempotente). O deploy converte `changelog/next.md` em JSON e faz o `PUT` depois de confirmar a versão no ar. O frontend tem `api/changelog.ts`, `lib/changelog.ts`, `pages/Changelog.tsx` e um ícone novo no ServerRail. O histórico entra por migration de seed, com texto aprovado pelo solicitante.

**Tech Stack:** Go + gin + pgx, Postgres, React + react-router + Tailwind, vitest (`renderToStaticMarkup`), `node:test` para scripts, GitHub Actions.

## Global Constraints

- Textos de interface e conteúdo do changelog em português do Brasil.
- Token no header `X-Changelog-Token`, valor do env `CHANGELOG_TOKEN` (secret do GitHub, sincronizado para o `.env` da VPS por `scripts/deploy-vps.sh`, `SYNCED_ENV`). Só caracteres `A-Za-z0-9,._:/@+-`.
- Versão no formato `X.Y.Z` (regex `^\d+\.\d+\.\d+$`), igual a `scripts/next-version.mjs`.
- `kind` é `feature` ou `fix`.
- `GET /api/changelog` exige login. `PUT` é idempotente (repetir o deploy não duplica).
- Migration nova é a `000047` (a última é a `000046`; números repetidos são pulados em silêncio, ver `scripts/check-migrations.mjs`). Só expande, sem DROP de dados.
- Commits e PRs sem atribuição de IA (regra do repo). Branch `caiolucio360/chang-log`, PR para `hugoemannuel/concord` `develop` (ver fluxo de git do projeto).
- O texto do seed retroativo (voltado ao usuário) só é gravado depois de aprovado pelo solicitante.

---

## File Structure

| Arquivo | Responsabilidade |
| --- | --- |
| `backend/migrations/000047_create_changelog.{up,down}.sql` | Tabelas do changelog |
| `backend/internal/changelog/changelog.go` | Tipos, interface `store`, validação |
| `backend/internal/changelog/repository.go` | SQL (listar, publicar em transação) |
| `backend/internal/changelog/handler.go` | `List` e `Publish` |
| `backend/internal/changelog/routes.go` | Rotas |
| `backend/internal/changelog/handler_test.go` | Testes do handler com store falso |
| `backend/cmd/main.go` | Ligação do pacote |
| `backend/.env.example`, `docs/HOSPEDAGEM.md` | `CHANGELOG_TOKEN` |
| `scripts/publish-changelog.mjs` + `.test.mjs` | `next.md` → JSON → `PUT` |
| `changelog/next.md` | Notas da próxima release |
| `scripts/deploy-vps.sh`, `.github/workflows/deploy.yml` | Token na VPS e passo de publicação |
| `frontend/src/renderer/src/api/changelog.ts` | Cliente HTTP |
| `frontend/src/renderer/src/lib/changelog.ts` + `.test.ts` | Agrupar e formatar |
| `frontend/src/renderer/src/pages/Changelog.tsx` + `.test.tsx` | Página |
| `frontend/src/main/updater.ts`, `preload/index.ts`, `preload/index.d.ts` | Versão em uso |
| `frontend/src/renderer/src/router.tsx`, `components/ServerRail.tsx`, `components/icons.tsx` | Acesso |
| `backend/migrations/000048_seed_changelog.up.sql` | Histórico retroativo |

---

### Task 1: Backend do changelog (migration, store, handler, rotas)

**Files:**
- Create: `backend/migrations/000047_create_changelog.up.sql`, `backend/migrations/000047_create_changelog.down.sql`
- Create: `backend/internal/changelog/changelog.go`, `repository.go`, `handler.go`, `routes.go`, `handler_test.go`

**Interfaces:**
- Produces: `changelog.NewRepository(db *pgxpool.Pool) *Repository`, `changelog.NewHandler(store store, token string) *Handler`, `changelog.Routes(router *gin.RouterGroup, h *Handler, authMiddleware gin.HandlerFunc)`.
- Produces (HTTP): `GET /api/changelog` → `[{"version","released_at","summary","entries":[{"kind","text"}]}]` (mais nova primeiro). `PUT /api/changelog/:version` body `{"released_at"?: RFC3339, "summary"?: string, "entries": [{"kind","text"}]}` → `204`.

- [ ] **Step 1: Migration**

`000047_create_changelog.up.sql`:

```sql
CREATE TABLE changelog_releases (
    id BIGSERIAL PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    summary TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_changelog_releases_released_at
    ON changelog_releases (released_at DESC, id DESC);

CREATE TABLE changelog_entries (
    id BIGSERIAL PRIMARY KEY,
    release_id BIGINT NOT NULL REFERENCES changelog_releases(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('feature', 'fix')),
    text TEXT NOT NULL,
    position INT NOT NULL
);

CREATE INDEX idx_changelog_entries_release
    ON changelog_entries (release_id, position);
```

`000047_create_changelog.down.sql`:

```sql
DROP TABLE IF EXISTS changelog_entries;
DROP TABLE IF EXISTS changelog_releases;
```

- [ ] **Step 2: Escrever os testes que falham**

`backend/internal/changelog/handler_test.go`:

```go
package changelog

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type fakeStore struct {
	releases []Release
	upserts  map[string]Publication
}

func (f *fakeStore) List(context.Context) ([]Release, error) { return f.releases, nil }

func (f *fakeStore) Upsert(_ context.Context, version string, p Publication) error {
	if f.upserts == nil {
		f.upserts = map[string]Publication{}
	}
	f.upserts[version] = p
	return nil
}

func serve(t *testing.T, st *fakeStore, token, method, path, sentToken, body string, logged bool) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	auth := func(c *gin.Context) {
		if !logged {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Next()
	}
	Routes(r.Group("/api"), NewHandler(st, token), auth)
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	if sentToken != "" {
		req.Header.Set("X-Changelog-Token", sentToken)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

const goodBody = `{"entries":[{"kind":"feature","text":"Changelog"},{"kind":"fix","text":"Corrigido"}]}`

func TestListRequiresLogin(t *testing.T) {
	w := serve(t, &fakeStore{}, "tok", http.MethodGet, "/api/changelog", "", "", false)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestListReturnsReleasesAndNeverNull(t *testing.T) {
	empty := serve(t, &fakeStore{}, "tok", http.MethodGet, "/api/changelog", "", "", true)
	if empty.Code != http.StatusOK || empty.Body.String() != "[]" {
		t.Fatalf("vazio: %d %q", empty.Code, empty.Body.String())
	}
	st := &fakeStore{releases: []Release{{
		Version: "0.6.2", ReleasedAt: time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC),
		Entries: []Entry{{Kind: KindFix, Text: "Corrigido"}},
	}}}
	w := serve(t, st, "tok", http.MethodGet, "/api/changelog", "", "", true)
	var got []Release
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil || len(got) != 1 || got[0].Version != "0.6.2" {
		t.Fatalf("resposta inesperada: %v %s", err, w.Body.String())
	}
}

func TestPublishNeedsTheToken(t *testing.T) {
	st := &fakeStore{}
	for _, sent := range []string{"", "errado"} {
		w := serve(t, st, "tok", http.MethodPut, "/api/changelog/0.6.3", sent, goodBody, false)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("token %q: status = %d", sent, w.Code)
		}
	}
	if len(st.upserts) != 0 {
		t.Fatal("publicou sem token válido")
	}
}

func TestPublishDisabledWithoutConfiguredToken(t *testing.T) {
	w := serve(t, &fakeStore{}, "", http.MethodPut, "/api/changelog/0.6.3", "qualquer", goodBody, false)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d", w.Code)
	}
}

func TestPublishStoresTheRelease(t *testing.T) {
	st := &fakeStore{}
	w := serve(t, st, "tok", http.MethodPut, "/api/changelog/0.6.3", "tok", goodBody, false)
	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d: %s", w.Code, w.Body.String())
	}
	got := st.upserts["0.6.3"]
	if len(got.Entries) != 2 || got.Entries[1].Kind != KindFix {
		t.Fatalf("entradas = %+v", got.Entries)
	}
	// Repetir o deploy não pode falhar nem duplicar: é um Upsert pela versão.
	if w := serve(t, st, "tok", http.MethodPut, "/api/changelog/0.6.3", "tok", goodBody, false); w.Code != http.StatusNoContent {
		t.Fatalf("repetido: status = %d", w.Code)
	}
}

func TestPublishRejectsBadInput(t *testing.T) {
	cases := map[string]struct{ path, body string }{
		"versão inválida": {"/api/changelog/abc", goodBody},
		"kind inválido":   {"/api/changelog/0.6.3", `{"entries":[{"kind":"x","text":"a"}]}`},
		"texto vazio":     {"/api/changelog/0.6.3", `{"entries":[{"kind":"fix","text":"  "}]}`},
		"json quebrado":   {"/api/changelog/0.6.3", `{`},
	}
	for name, tc := range cases {
		st := &fakeStore{}
		w := serve(t, st, "tok", http.MethodPut, tc.path, "tok", tc.body, false)
		if w.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d", name, w.Code)
		}
		if len(st.upserts) != 0 {
			t.Errorf("%s: gravou", name)
		}
	}
}
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && go test ./internal/changelog/ -run . -count=1`
Expected: FAIL (pacote sem código: `undefined: Release`, `NewHandler`, ...).

- [ ] **Step 4: Tipos e validação**

`backend/internal/changelog/changelog.go`:

```go
// Package changelog guarda, por versão do app, o que cada release trouxe.
// As releases chegam pelo deploy (PUT com token de CI) e todo usuário logado lê.
package changelog

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
)

const (
	KindFeature = "feature"
	KindFix     = "fix"

	maxEntries   = 100
	maxEntryText = 500
	maxSummary   = 500
)

var versionRe = regexp.MustCompile(`^\d+\.\d+\.\d+$`)

type Entry struct {
	Kind string `json:"kind"`
	Text string `json:"text"`
}

type Release struct {
	Version    string    `json:"version"`
	ReleasedAt time.Time `json:"released_at"`
	Summary    string    `json:"summary"`
	Entries    []Entry   `json:"entries"`
}

// Publication é o corpo do PUT. Sem released_at, uma release nova usa a hora
// atual e uma existente mantém a data que já tinha.
type Publication struct {
	ReleasedAt *time.Time `json:"released_at"`
	Summary    string     `json:"summary"`
	Entries    []Entry    `json:"entries"`
}

type store interface {
	List(ctx context.Context) ([]Release, error)
	Upsert(ctx context.Context, version string, p Publication) error
}

func (p *Publication) validate() error {
	p.Summary = strings.TrimSpace(p.Summary)
	if len(p.Summary) > maxSummary {
		return errors.New("summary muito longo")
	}
	if len(p.Entries) > maxEntries {
		return errors.New("entradas demais")
	}
	for i := range p.Entries {
		e := &p.Entries[i]
		e.Text = strings.TrimSpace(e.Text)
		if e.Kind != KindFeature && e.Kind != KindFix {
			return errors.New("kind inválido")
		}
		if e.Text == "" || len(e.Text) > maxEntryText {
			return errors.New("texto inválido")
		}
	}
	return nil
}
```

- [ ] **Step 5: Handler e rotas**

`backend/internal/changelog/handler.go`:

```go
package changelog

import (
	"crypto/subtle"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	store store
	token string
}

func NewHandler(store store, token string) *Handler {
	return &Handler{store: store, token: token}
}

// List devolve todas as releases, da mais nova para a mais antiga: GET /changelog.
func (h *Handler) List(c *gin.Context) {
	releases, err := h.store.List(c.Request.Context())
	if err != nil {
		log.Printf("[changelog] list: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load changelog"})
		return
	}
	if releases == nil {
		releases = []Release{}
	}
	c.JSON(http.StatusOK, releases)
}

// Publish grava (ou regrava) uma release: PUT /changelog/:version. Quem chama é
// o deploy, com o token do CI; sem CHANGELOG_TOKEN no servidor fica desligado.
func (h *Handler) Publish(c *gin.Context) {
	if h.token == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "publishing disabled"})
		return
	}
	if subtle.ConstantTimeCompare([]byte(c.GetHeader("X-Changelog-Token")), []byte(h.token)) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	version := c.Param("version")
	if !versionRe.MatchString(version) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid version"})
		return
	}
	var p Publication
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if err := p.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.store.Upsert(c.Request.Context(), version, p); err != nil {
		log.Printf("[changelog] publish %s: %v", version, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to publish"})
		return
	}
	c.Status(http.StatusNoContent)
}
```

`backend/internal/changelog/routes.go`:

```go
package changelog

import "github.com/gin-gonic/gin"

// Routes: a leitura exige login; o PUT não usa JWT, só o token do CI.
func Routes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	router.GET("/changelog", authMiddleware, handler.List)
	router.PUT("/changelog/:version", handler.Publish)
}
```

- [ ] **Step 6: Repository**

`backend/internal/changelog/repository.go`:

```go
package changelog

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context) ([]Release, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, version, released_at, summary
		 FROM changelog_releases
		 ORDER BY released_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var releases []Release
	index := map[int64]int{}
	for rows.Next() {
		var id int64
		var rel Release
		if err := rows.Scan(&id, &rel.Version, &rel.ReleasedAt, &rel.Summary); err != nil {
			return nil, err
		}
		rel.Entries = []Entry{}
		index[id] = len(releases)
		releases = append(releases, rel)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	erows, err := r.db.Query(ctx,
		`SELECT release_id, kind, text FROM changelog_entries ORDER BY release_id, position`)
	if err != nil {
		return nil, err
	}
	defer erows.Close()
	for erows.Next() {
		var id int64
		var e Entry
		if err := erows.Scan(&id, &e.Kind, &e.Text); err != nil {
			return nil, err
		}
		if i, ok := index[id]; ok {
			releases[i].Entries = append(releases[i].Entries, e)
		}
	}
	return releases, erows.Err()
}

// Upsert cria a release ou troca as entradas da que já existe, numa transação:
// repetir o deploy deixa o mesmo resultado.
func (r *Repository) Upsert(ctx context.Context, version string, p Publication) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var id int64
	err = tx.QueryRow(ctx,
		`INSERT INTO changelog_releases (version, released_at, summary)
		 VALUES ($1, COALESCE($2::timestamptz, NOW()), $3)
		 ON CONFLICT (version) DO UPDATE
		   SET released_at = COALESCE($2::timestamptz, changelog_releases.released_at),
		       summary = EXCLUDED.summary
		 RETURNING id`,
		version, p.ReleasedAt, p.Summary).Scan(&id)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM changelog_entries WHERE release_id = $1`, id); err != nil {
		return err
	}
	for i, e := range p.Entries {
		if _, err := tx.Exec(ctx,
			`INSERT INTO changelog_entries (release_id, kind, text, position) VALUES ($1, $2, $3, $4)`,
			id, e.Kind, e.Text, i); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd backend && go vet ./internal/changelog/ && go test ./internal/changelog/ -count=1`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/migrations/000047_create_changelog.up.sql backend/migrations/000047_create_changelog.down.sql backend/internal/changelog
git commit -m "feat(changelog): tabelas, leitura e publicação por token"
```

---

### Task 2: Ligar o pacote no servidor e configurar o token

**Files:**
- Modify: `backend/cmd/main.go` (imports ~l.17-40; rotas ~l.519-524)
- Modify: `backend/.env.example` (perto de `TECH_TEAM_USER_IDS`, l.104-111)
- Modify: `docs/HOSPEDAGEM.md` (perto da l.767)
- Modify: `scripts/deploy-vps.sh:199` e `scripts/deploy-vps.test.mjs`

**Interfaces:**
- Consumes: `changelog.NewRepository`, `changelog.NewHandler`, `changelog.Routes` (Task 1).
- Produces: env `CHANGELOG_TOKEN` lido pelo servidor e sincronizado pelo deploy.

- [ ] **Step 1: Teste do deploy que falha**

Em `scripts/deploy-vps.test.mjs`, depois do teste `'TECH_TEAM_USER_IDS entra no .env da VPS sem apagar o resto'` (l.210), copie-o trocando o nome da variável por `CHANGELOG_TOKEN` e o valor por `abc123DEF456`:

```js
test('CHANGELOG_TOKEN entra no .env da VPS sem apagar o resto', () => {
  // Mesmo setup do teste de TECH_TEAM_USER_IDS logo acima.
  const ctx = setup({ '.env': 'export PORT="8090" # backend\n' })
  const r = deploy(ctx, ['root@vps'], { CHANGELOG_TOKEN: 'abc123DEF456' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /CHANGELOG_TOKEN gravado/)
  assert.equal(read(ctx, '.env'), `export PORT="8090" # backend\nCHANGELOG_TOKEN=abc123DEF456\n`)
})
```

Antes de salvar, leia as linhas 205-216 do arquivo e use exatamente os mesmos helpers (`setup`/`deploy`/`read` ou os nomes reais) do teste vizinho.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test scripts/deploy-vps.test.mjs`
Expected: o teste novo FAIL (a variável não é sincronizada).

- [ ] **Step 3: Sincronizar o token**

`scripts/deploy-vps.sh:199`:

```bash
SYNCED_ENV=(TECH_TEAM_USER_IDS CHANGELOG_TOKEN)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test scripts/deploy-vps.test.mjs`
Expected: PASS.

- [ ] **Step 5: Ligar no main.go**

Adicione o import `"gin-quickstart/backend/internal/changelog"` (ordem alfabética, entre `channel` e o seguinte) e, junto das outras rotas protegidas, depois de `birthday.BirthdayRoutes(...)`:

```go
	changelog.Routes(api, changelog.NewHandler(changelog.NewRepository(db), os.Getenv("CHANGELOG_TOKEN")), authMiddleware)
```

- [ ] **Step 6: Documentar a variável**

`backend/.env.example`, após o bloco do `TECH_TEAM_USER_IDS`:

```
# CHANGELOG_TOKEN: segredo com que o deploy publica as notas de cada versão
# (PUT /api/changelog/:versão). Vazio = publicação desligada (a leitura segue).
# Em produção vem do secret do GitHub de mesmo nome (scripts/deploy-vps.sh).
CHANGELOG_TOKEN=
```

`docs/HOSPEDAGEM.md`, ao lado do item de `TECH_TEAM_USER_IDS`: um item `CHANGELOG_TOKEN` (secret do GitHub; gere com `openssl rand -hex 24`; o deploy grava no `.env` da VPS e usa no passo "Changelog").

- [ ] **Step 7: Compilar e testar**

Run: `cd backend && go build ./... && go test ./cmd/... ./internal/changelog/ -count=1`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/cmd/main.go backend/.env.example docs/HOSPEDAGEM.md scripts/deploy-vps.sh scripts/deploy-vps.test.mjs
git commit -m "feat(changelog): ligar rotas no servidor e sincronizar CHANGELOG_TOKEN"
```

---

### Task 3: Publicação no deploy (`changelog/next.md`)

**Files:**
- Create: `scripts/publish-changelog.mjs`, `scripts/publish-changelog.test.mjs`, `changelog/next.md`
- Modify: `.github/workflows/deploy.yml` (novo passo depois de "Conferir")

**Interfaces:**
- Produces: `parseNotes(markdown): {entries: {kind, text}[]}` e CLI `node scripts/publish-changelog.mjs <versão> <arquivo.md> <base-url>` (lê `CHANGELOG_TOKEN` do ambiente, faz o `PUT`, e só então esvazia o arquivo).

- [ ] **Step 1: Testes que falham**

`scripts/publish-changelog.test.mjs`:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EMPTY_NOTES, parseNotes } from './publish-changelog.mjs'

test('separa novidades e correções, na ordem do arquivo', () => {
  const md = [
    '## Novidades',
    '- Changelog global',
    '* Outra novidade',
    '',
    '## Correções',
    '- Corrigido o som'
  ].join('\n')
  assert.deepEqual(parseNotes(md).entries, [
    { kind: 'feature', text: 'Changelog global' },
    { kind: 'feature', text: 'Outra novidade' },
    { kind: 'fix', text: 'Corrigido o som' }
  ])
})

test('arquivo vazio ou só com os títulos não tem entradas', () => {
  assert.deepEqual(parseNotes('').entries, [])
  assert.deepEqual(parseNotes(EMPTY_NOTES).entries, [])
})

test('bullet fora de uma seção é erro (evita publicar como o tipo errado)', () => {
  assert.throws(() => parseNotes('- solto'), /seção/)
})

test('seção desconhecida é erro', () => {
  assert.throws(() => parseNotes('## Outros\n- x'), /Outros/)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test scripts/publish-changelog.test.mjs`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

`scripts/publish-changelog.mjs`:

```js
// Publica as notas da release no changelog do app.
//
//   CHANGELOG_TOKEN=… node scripts/publish-changelog.mjs <versão> <notas.md> <url-base>
//
// Lê `changelog/next.md` (seções "## Novidades" e "## Correções" em bullets),
// faz o PUT idempotente em <url-base>/api/changelog/<versão> e, só se deu
// certo, deixa o arquivo vazio para a próxima release.
import { readFileSync, writeFileSync } from 'node:fs'

export const EMPTY_NOTES = '## Novidades\n\n## Correções\n'

const SECTIONS = { novidades: 'feature', correções: 'fix', correcoes: 'fix' }

export function parseNotes(markdown) {
  const entries = []
  let kind = null
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const heading = /^##\s+(.+)$/.exec(line)
    if (heading) {
      kind = SECTIONS[heading[1].trim().toLowerCase()]
      if (!kind) throw new Error(`seção desconhecida: ${heading[1].trim()}`)
      continue
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    if (!bullet) continue
    if (!kind) throw new Error(`bullet fora de uma seção: ${line}`)
    entries.push({ kind, text: bullet[1].trim() })
  }
  return { entries }
}

async function main([version, file, baseUrl]) {
  const token = process.env.CHANGELOG_TOKEN
  if (!version || !file || !baseUrl || !token) {
    throw new Error('uso: CHANGELOG_TOKEN=… publish-changelog.mjs <versão> <notas.md> <url-base>')
  }
  const { entries } = parseNotes(readFileSync(file, 'utf8'))
  if (entries.length === 0) console.warn(`::warning::changelog/next.md vazio: ${version} sai sem notas`)
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/changelog/${version}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Changelog-Token': token },
    body: JSON.stringify({ entries })
  })
  if (!res.ok) throw new Error(`PUT /api/changelog/${version}: HTTP ${res.status}`)
  writeFileSync(file, EMPTY_NOTES)
  console.log(`changelog ${version}: ${entries.length} entradas publicadas`)
}

if (process.argv[1]?.endsWith('publish-changelog.mjs')) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
```

`changelog/next.md` (o conteúdo da própria release deste PR):

```markdown
## Novidades

- Changelog: agora você vê, por versão, o que mudou no app. Clique no ícone de novidades na barra lateral.

## Correções
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test scripts/publish-changelog.test.mjs`
Expected: PASS.

- [ ] **Step 5: Passo no workflow**

Em `.github/workflows/deploy.yml`, depois do passo `Conferir` (mesmo nível), adicione:

```yaml
      # Depois do "Conferir": a versão já está no ar e o endpoint novo também.
      # Falha aqui não desfaz o deploy; só deixa a release sem notas até o
      # próximo (o PUT é idempotente e next.md só esvazia depois de gravar).
      - name: Changelog
        env:
          CHANGELOG_TOKEN: ${{ secrets.CHANGELOG_TOKEN }}
        run: node scripts/publish-changelog.mjs "${{ steps.version.outputs.version }}" changelog/next.md "$PUBLIC_URL"
```

No passo "Publicar na VPS" já existente, acrescente o secret ao `env` (é o que a Task 2 sincroniza para o `.env` da VPS):

```yaml
        env:
          TECH_TEAM_USER_IDS: ${{ secrets.TECH_TEAM_USER_IDS }}
          CHANGELOG_TOKEN: ${{ secrets.CHANGELOG_TOKEN }}
```

Observação: o esvaziamento de `next.md` acontece no runner e não vai para o git. Por isso o passo final comita o arquivo vazio de volta só se o repo permitir push da `main` pelo Actions; se não permitir, o time esvazia o `next.md` no PR de release seguinte (regra do README abaixo). Confirme com o solicitante qual dos dois vale antes de implementar o commit automático; sem resposta, **não** adicione commit automático.

- [ ] **Step 6: Documentar a regra no README do repo**

Em `README.md`, na seção de contribuição/PR (procure por "PR"), acrescente: "Todo PR de feature ou correção visível ao usuário adiciona uma linha em `changelog/next.md` (Novidades ou Correções). O deploy publica o arquivo na versão que subir e o PR de release seguinte parte dele vazio (`## Novidades` / `## Correções`)."

- [ ] **Step 7: Commit**

```bash
git add scripts/publish-changelog.mjs scripts/publish-changelog.test.mjs changelog/next.md .github/workflows/deploy.yml README.md
git commit -m "feat(changelog): publicar as notas da release no deploy"
```

---

### Task 4: Frontend (página, rota e atalho no ServerRail)

**Files:**
- Create: `frontend/src/renderer/src/api/changelog.ts`, `lib/changelog.ts`, `lib/changelog.test.ts`, `pages/Changelog.tsx`, `pages/Changelog.test.tsx`
- Modify: `frontend/src/main/updater.ts` (~l.327), `frontend/src/preload/index.ts` (bloco `updates`, ~l.64), `frontend/src/preload/index.d.ts` (`UpdatesApi`, l.31-43), `renderer/src/router.tsx`, `renderer/src/components/icons.tsx`, `renderer/src/components/ServerRail.tsx`

**Interfaces:**
- Consumes: `GET /api/changelog` (Task 1).
- Produces: `window.api.updates.currentVersion(): Promise<string>` (só desktop), `fetchChangelog(): Promise<ChangelogRelease[]>`, `groupEntries(release)`, `formatReleaseDate(iso)`, `ChangelogView` (props `{ releases, current, loading, error }`).

- [ ] **Step 1: Testes da lib que falham**

`frontend/src/renderer/src/lib/changelog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatReleaseDate, groupEntries } from './changelog'

const release = {
  version: '0.6.2',
  released_at: '2026-10-24T15:00:00Z',
  summary: '',
  entries: [
    { kind: 'fix' as const, text: 'b' },
    { kind: 'feature' as const, text: 'a' },
    { kind: 'feature' as const, text: 'c' }
  ]
}

describe('groupEntries', () => {
  it('separa novidades e correções mantendo a ordem', () => {
    expect(groupEntries(release)).toEqual({
      features: ['a', 'c'],
      fixes: ['b']
    })
  })
})

describe('formatReleaseDate', () => {
  it('formata em pt-BR', () => {
    expect(formatReleaseDate('2026-10-24T15:00:00Z')).toBe('24 de out. de 2026')
  })
  it('data inválida vira vazio', () => {
    expect(formatReleaseDate('nada')).toBe('')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/renderer/src/lib/changelog.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: API e lib**

`api/changelog.ts`:

```ts
import { request } from './client'

export type ChangelogKind = 'feature' | 'fix'

export interface ChangelogEntry {
  kind: ChangelogKind
  text: string
}

/** Uma versão do app e o que ela trouxe (backend: internal/changelog). */
export interface ChangelogRelease {
  version: string
  released_at: string
  summary: string
  entries: ChangelogEntry[]
}

/** Da release mais nova para a mais antiga. */
export function fetchChangelog(): Promise<ChangelogRelease[]> {
  return request<ChangelogRelease[]>('/changelog')
}
```

`lib/changelog.ts`:

```ts
import type { ChangelogRelease } from '../api/changelog'

export function groupEntries(release: ChangelogRelease): { features: string[]; fixes: string[] } {
  const features: string[] = []
  const fixes: string[] = []
  for (const e of release.entries) (e.kind === 'feature' ? features : fixes).push(e.text)
  return { features, fixes }
}

export function formatReleaseDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
```

Se a asserção `'24 de out. de 2026'` divergir da saída do ICU do Node (ex.: `24 de outubro de 2026`), ajuste o **teste** para a saída real de `month: 'long'` antes de seguir. A data mostrada ao usuário usa o mês por extenso.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/renderer/src/lib/changelog.test.ts`
Expected: PASS.

- [ ] **Step 5: Teste da página que falha**

`pages/Changelog.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChangelogView } from './Changelog'

const releases = [
  {
    version: '0.6.2',
    released_at: '2026-10-24T15:00:00Z',
    summary: '',
    entries: [
      { kind: 'feature' as const, text: 'Mensagens fixadas' },
      { kind: 'fix' as const, text: 'Som da chamada' }
    ]
  },
  { version: '0.6.1', released_at: '2026-10-20T15:00:00Z', summary: '', entries: [] }
]

const render = (over: Partial<Parameters<typeof ChangelogView>[0]> = {}): string =>
  renderToStaticMarkup(
    <ChangelogView releases={releases} current={null} loading={false} error={null} {...over} />
  )

describe('ChangelogView', () => {
  it('mostra versão, novidades e correções', () => {
    const html = render()
    expect(html).toContain('v0.6.2')
    expect(html).toContain('Novidades')
    expect(html).toContain('Mensagens fixadas')
    expect(html).toContain('Correções')
    expect(html).toContain('Som da chamada')
  })

  it('marca a versão em uso', () => {
    expect(render({ current: '0.6.1' })).toContain('Você está aqui')
    expect(render({ current: null })).not.toContain('Você está aqui')
  })

  it('release sem entradas avisa que não há notas', () => {
    expect(render()).toContain('Sem notas para esta versão')
  })

  it('carregando, com erro e vazio', () => {
    expect(render({ loading: true, releases: [] })).toContain('Carregando')
    expect(render({ error: 'falhou', releases: [] })).toContain('falhou')
    expect(render({ releases: [] })).toContain('Nenhuma versão publicada ainda')
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/renderer/src/pages/Changelog.test.tsx`
Expected: FAIL (módulo inexistente).

- [ ] **Step 7: Ícone, página e IPC da versão**

`components/icons.tsx` (ao lado do `InboxIcon`):

```tsx
export function ChangelogIcon({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </svg>
  )
}
```

`pages/Changelog.tsx` (cabeçalho e fundo iguais aos de `pages/Invites.tsx`):

```tsx
import { useEffect, useState } from 'react'
import { fetchChangelog, type ChangelogRelease } from '../api/changelog'
import { ChangelogIcon } from '../components/icons'
import { formatReleaseDate, groupEntries } from '../lib/changelog'

interface ViewProps {
  releases: ChangelogRelease[]
  /** Versão instalada (desktop); null na web ou enquanto não se sabe. */
  current: string | null
  loading: boolean
  error: string | null
}

function Group({ title, items, tone }: { title: string; items: string[]; tone: string }): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <div className="mt-3">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{title}</span>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-300">
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </div>
  )
}

export function ChangelogView({ releases, current, loading, error }: ViewProps): React.JSX.Element {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[#07080b]/90 backdrop-blur-2xl text-gray-100">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/6 px-4">
          <ChangelogIcon className="h-5 w-5 text-violet-400" />
          <h1 className="text-base font-semibold">Novidades</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {loading && <p className="text-sm text-gray-400">Carregando…</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {!loading && !error && releases.length === 0 && (
              <p className="text-sm text-gray-400">Nenhuma versão publicada ainda.</p>
            )}
            {releases.map((rel) => {
              const { features, fixes } = groupEntries(rel)
              return (
                <section key={rel.version} className="rounded-xl border border-white/6 bg-[#12141d]/80 p-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-lg font-bold">v{rel.version}</h2>
                    <span className="text-xs text-gray-400">{formatReleaseDate(rel.released_at)}</span>
                    {current === rel.version && (
                      <span className="rounded-full bg-violet-600/30 px-2 py-0.5 text-xs font-semibold text-violet-300">
                        Você está aqui
                      </span>
                    )}
                  </div>
                  {rel.summary && <p className="mt-1 text-sm text-gray-400">{rel.summary}</p>}
                  <Group title="Novidades" items={features} tone="bg-emerald-500/20 text-emerald-300" />
                  <Group title="Correções" items={fixes} tone="bg-amber-500/20 text-amber-300" />
                  {features.length + fixes.length === 0 && (
                    <p className="mt-3 text-sm text-gray-500">Sem notas para esta versão.</p>
                  )}
                </section>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}

function Changelog(): React.JSX.Element {
  const [releases, setReleases] = useState<ChangelogRelease[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchChangelog()
      .then((r) => alive && setReleases(r))
      .catch(() => alive && setError('Não foi possível carregar as novidades.'))
      .finally(() => alive && setLoading(false))
    window.api?.updates?.currentVersion().then((v) => alive && setCurrent(v), () => {})
    return () => {
      alive = false
    }
  }, [])

  return <ChangelogView releases={releases} current={current} loading={loading} error={error} />
}

export default Changelog
```

Versão em uso — `frontend/src/main/updater.ts`, junto do `ipcMain.handle('update:status', …)` (l.327):

```ts
  ipcMain.handle('update:current-version', () => app.getVersion())
```

`frontend/src/preload/index.ts`, no bloco `updates`:

```ts
    /** Versão instalada deste app. */
    currentVersion(): Promise<string> {
      return ipcRenderer.invoke('update:current-version')
    },
```

`frontend/src/preload/index.d.ts`, em `UpdatesApi`:

```ts
  currentVersion(): Promise<string>
```

- [ ] **Step 8: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/renderer/src/pages/Changelog.test.tsx src/main/updater.test.ts`
Expected: PASS (o mock do updater já tem `app.getVersion`).

- [ ] **Step 9: Rota e atalho**

`router.tsx`: `import Changelog from './pages/Changelog'` e, em `children`, depois de `proposals`:

```tsx
      { path: 'changelog', element: <Changelog /> },
```

`components/ServerRail.tsx`: importe `ChangelogIcon` junto dos outros ícones (l.4), declare `const onChangelog = location.pathname === '/changelog'` ao lado de `onProposals` (l.46) e, logo depois do bloco do botão de Propostas (antes do comentário `Real User Servers List`):

```tsx
        {/* Novidades: changelog por versão */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => {
              clearCurrentServer()
              navigate('/changelog')
            }}
            title="Novidades"
            aria-label="Novidades"
            className={`relative flex h-12 w-12 cursor-pointer items-center justify-center transition-all duration-200 ${
              onChangelog
                ? 'rounded-2xl bg-violet-600 shadow-md shadow-violet-500/30'
                : 'rounded-3xl border border-white/6 bg-[#12141d]/80 hover:rounded-2xl hover:bg-violet-600 hover:shadow-md hover:shadow-violet-500/30'
            }`}
          >
            <ChangelogIcon className={`h-6 w-6 ${onChangelog ? 'text-white' : 'text-violet-400'}`} />
          </button>
        </div>
```

- [ ] **Step 10: Typecheck, lint e testes**

Run: `cd frontend && npx yarn typecheck && npx yarn lint && npx vitest run`
Expected: tudo PASS.

- [ ] **Step 11: Commit**

```bash
git add frontend/src
git commit -m "feat(changelog): página de novidades e atalho no ServerRail"
```

---

### Task 5: Histórico retroativo (seed)

**Files:**
- Create: `backend/migrations/000048_seed_changelog.up.sql`, `backend/migrations/000048_seed_changelog.down.sql`
- Temporários (fora do git, na pasta de scratchpad da sessão): `releases.json`, `draft.md`, `seed.mjs`

**Interfaces:**
- Consumes: tabelas da Task 1.
- Produces: uma linha em `changelog_releases` por release já feita, com entradas.

- [ ] **Step 1: Descobrir a versão publicada e se o último merge já foi ao ar**

Run: `gh variable get PUBLIC_URL --repo hugoemannuel/concord`, depois `curl -fsS "<PUBLIC_URL>/updates/latest.yml" | grep '^version:'` e `gh run list --repo hugoemannuel/concord --workflow deploy.yml --limit 5`.
Expected: versão `P` e o deploy do merge `ba09815` (PR #161) concluído. Se esse deploy ainda não terminou, a release mais nova do seed é a do merge anterior (`add66dd`, #153) e o #161 sai pelo `next.md` do próprio deploy.

- [ ] **Step 2: Listar as releases e seus commits**

```bash
git log main --first-parent --reverse --format='%H|%cI|%s' > releases.txt
while IFS='|' read -r sha date subject; do
  echo "### $sha $date $subject"
  git log --no-merges --format='- %s' "$sha^1..$sha^2"
done < releases.txt > commits-por-release.md
```

Só entram merges de `develop` na `main` (linhas cujo assunto termina em `from hugoemannuel/develop`, mais os merges diretos de feature, como `#65`, que também são releases porque dispararam deploy). Cada merge vira uma release.

- [ ] **Step 3: Numerar**

Com `k` releases, a i-ésima (a partir da mais antiga, `i` de 0) recebe `X.Y.(patchP − (k−1−i))`. Se `patchP < k−1`, **pare e pergunte ao solicitante** como numerar (o patch não pode ficar negativo).

- [ ] **Step 4: Rascunhar o texto**

Para cada release, escreva em `draft.md` as entradas em português, linguagem de usuário, uma frase cada, em `## Novidades` / `## Correções`. Ignore CI, refactor, docs, testes e chores. Funde commits que são a mesma coisa. Uma release só com itens invisíveis fica sem entradas (a página mostra "Sem notas para esta versão").

- [ ] **Step 5: Aprovação (portão)**

Mostre o `draft.md` completo ao solicitante e **espere a aprovação**. Aplique os ajustes pedidos. Não siga sem aprovação.

- [ ] **Step 6: Gerar o SQL**

Converta o texto aprovado em `releases.json` (`[{"version","released_at","entries":[{"kind","text"}]}]`, `released_at` = data do merge) e rode `node seed.mjs releases.json > backend/migrations/000048_seed_changelog.up.sql`, com:

```js
import { readFileSync } from 'node:fs'
const q = (s) => `'${String(s).replaceAll("'", "''")}'`
const releases = JSON.parse(readFileSync(process.argv[2], 'utf8'))
let sql = '-- Histórico retroativo montado a partir dos commits de cada release.\n'
for (const r of releases) {
  sql += `\nWITH rel AS (\n  INSERT INTO changelog_releases (version, released_at) VALUES (${q(r.version)}, ${q(r.released_at)})\n  ON CONFLICT (version) DO NOTHING RETURNING id\n)\n`
  const rows = r.entries.map((e, i) => `(${q(e.kind)}, ${q(e.text)}, ${i})`)
  sql += rows.length
    ? `INSERT INTO changelog_entries (release_id, kind, text, position)\nSELECT rel.id, v.kind, v.text, v.position FROM rel,\n  (VALUES ${rows.join(',\n  ')}) AS v(kind, text, position);\n`
    : `SELECT 1;\n`
}
process.stdout.write(sql)
```

Se a versão já existir, `rel` vem vazio e o `INSERT ... SELECT` não grava nada (a migration não falha nem duplica).

`000048_seed_changelog.down.sql`: `DELETE FROM changelog_releases WHERE released_at < '2026-10-25';` (apaga só o histórico semeado; as entradas saem por `ON DELETE CASCADE`).

- [ ] **Step 7: Validar**

Run: `node scripts/check-migrations.mjs` (números sem repetição) e aplique em um Postgres local: `cd backend && go run ./cmd migrate`, depois `psql "$DATABASE_URL" -c "SELECT version, count(e.id) FROM changelog_releases r LEFT JOIN changelog_entries e ON e.release_id = r.id GROUP BY version ORDER BY version"`.
Expected: `k` linhas, versões únicas e contagens iguais ao `draft.md`. Se não houver Postgres local, diga isso ao solicitante em vez de afirmar que funcionou.

- [ ] **Step 8: Commit**

```bash
git add backend/migrations/000048_seed_changelog.up.sql backend/migrations/000048_seed_changelog.down.sql
git commit -m "feat(changelog): histórico retroativo das releases"
```

---

## Self-Review

- **Spec coverage:** banco + endpoints (Task 1), token e config (Task 2), publicação no deploy via `next.md` (Task 3), página/rota/ícone (Task 4), retroativo com numeração ancorada e aprovação de texto (Task 5), testes Go e vitest (Tasks 1 e 4), destaque "Você está aqui" (Task 4).
- **Desvio do spec:** os atalhos extras (versão nas Configurações e `UpdateBar`) ficaram de fora. As Configurações não mostram versão hoje e o ServerRail já dá acesso em 1 clique. O spec foi ajustado.
- **Ponto aberto:** o esvaziamento de `changelog/next.md` ocorre no runner e não volta ao git (Task 3, Step 5): decidir com o solicitante se o Actions pode comitar na `main`; o plano não faz isso por conta própria.
