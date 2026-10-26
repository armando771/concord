# Estilo do nome de exibição (fonte + efeito) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada pessoa escolhe fonte e efeito (cores) do próprio nome de exibição, e o estilo aparece onde o nome é mostrado.

**Architecture:** Três colunas novas em `users` (`name_font`, `name_effect`, `name_colors`). Um pacote Go pequeno `namestyle` guarda os IDs válidos, a validação e a expressão SQL que monta o objeto `name_style` (JSON) para qualquer query que junte `users`. No frontend, `lib/nameStyle.ts` é o catálogo (IDs → CSS) e `<StyledName>` o único componente que desenha nome estilizado; ele lê o estilo ao vivo do `profileStore` (evento `user:update`) e cai no estilo que veio com a mensagem/membro.

**Tech Stack:** Go 1.26 + gin + pgx v5 + Postgres; React 19 + TypeScript + Vite + vitest; fontes `@fontsource/*` (OFL) empacotadas.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-25-fonte-apelido-design.md`.
- Migração nova é `000047` (a última existente é `000046`). Só acrescenta colunas com padrão: o binário anterior continua funcionando.
- Padrões: `name_font='default'`, `name_effect='solid'`, `name_colors='{}'`.
- Backend valida contra listas fixas de IDs; cores são `^#[0-9a-fA-F]{6}$` guardadas em minúsculas; no máximo 2 cores. Nunca CSS livre.
- Cliente antigo que não manda `name_style` no `PUT /users/me/profile` não pode apagar o estilo (campo é ponteiro; ausente = mantém).
- Textos de interface em português (pt-BR), como o resto do app.
- Fontes empacotadas offline (CSP é `default-src 'self'`, sem CDN). Só o subset `latin` e 1-2 pesos por família. A licença OFL de cada fonte vai junto no build.
- Servidor com apelido (`server_members.nickname`) mostra o apelido sem estilo; o estilo vale para o nome de exibição.
- Commits e PRs sem atribuição de IA (regra do repo). Mensagens de commit em português, no estilo do histórico (`feat:`, `test:`, `docs:`).
- Ambiente (ver memória `concord-dev-env`): Go e yarn não estão no PATH. Go: baixar o zip go1.26.x do Windows no scratchpad e chamar `go.exe` de lá. Frontend: `npx --yes yarn@1.22.22 install --frozen-lockfile --ignore-scripts`. Testes de banco (`DATABASE_URL`) não rodam sem Docker; os testes deste plano usam fakes.

## Mapa de arquivos

Backend:
- Create `backend/migrations/000047_user_name_style.up.sql` / `.down.sql`
- Create `backend/internal/namestyle/namestyle.go` + `namestyle_test.go`
- Modify `backend/internal/user/model.go`, `profile.go`, `repository.go`, `profile_handler_test.go`, `profile_test.go`
- Modify `backend/internal/message/model.go`, `repository.go`
- Modify `backend/internal/server/model.go`, `repository.go`
- Modify `backend/internal/conversation/model.go`, `repository.go`
- Modify `backend/internal/friendship/repository.go`
- Modify `backend/internal/call/model.go`, `service.go`

Frontend (`frontend/src/renderer/src/`):
- Create `lib/nameStyle.ts` + `lib/nameStyle.test.ts` (catálogo, CSS, paridade com o Go)
- Create `assets/nameFonts.css`, `assets/nameStyle.css`
- Create `components/StyledName.tsx`
- Modify `lib/profileValidation.ts`, `api/users.ts`, `store/authStore.ts`, `store/profileStore.ts`
- Modify `components/settings/sections/ProfilesSection.tsx`
- Create `components/settings/NameStyleEditor.tsx`
- Modify os pontos de uso (Task 7)
- Modify `frontend/package.json`, `frontend/vite.renderer.shared.ts`, `frontend/electron-builder.yml`

---

### Task 1: Migração e pacote `namestyle`

**Files:**
- Create: `backend/migrations/000047_user_name_style.up.sql`, `backend/migrations/000047_user_name_style.down.sql`
- Create: `backend/internal/namestyle/namestyle.go`
- Test: `backend/internal/namestyle/namestyle_test.go`

**Interfaces:**
- Produces:
  - `namestyle.Style{Font string; Effect string; Colors []string}` com tags JSON `font`, `effect`, `colors`
  - `namestyle.Fonts []string`, `namestyle.Effects []string` (IDs válidos; o teste de paridade do frontend lê estas duas listas)
  - `namestyle.Default() Style`
  - `namestyle.Validate(s Style) (Style, error)` — devolve o estilo arrumado (cores em minúsculas, `Colors` nunca nil) ou erro que satisfaz `errors.Is(err, namestyle.ErrInvalid)`
  - `namestyle.Expr(alias string) string` — expressão SQL jsonb para `SELECT`, ex.: `namestyle.Expr("u")`

- [ ] **Step 1: Escrever o teste que falha**

```go
package namestyle

import (
	"errors"
	"strings"
	"testing"
)

func TestValidate(t *testing.T) {
	cases := []struct {
		name string
		in   Style
		ok   bool
	}{
		{"padrão", Style{Font: "default", Effect: "solid"}, true},
		{"fonte inexistente", Style{Font: "comic", Effect: "solid"}, false},
		{"efeito inexistente", Style{Font: "default", Effect: "blink"}, false},
		{"fonte vazia", Style{Font: "", Effect: "solid"}, false},
		{"sólido com uma cor", Style{Font: "tempo", Effect: "solid", Colors: []string{"#A1B2C3"}}, true},
		{"degradê com duas cores", Style{Font: "tempo", Effect: "gradient", Colors: []string{"#ff0000", "#0000ff"}}, true},
		{"degradê com uma cor", Style{Font: "tempo", Effect: "gradient", Colors: []string{"#ff0000"}}, false},
		{"neon sem cor", Style{Font: "tempo", Effect: "neon"}, false},
		{"arco-íris sem cor", Style{Font: "bit8", Effect: "rainbow"}, true},
		{"três cores", Style{Font: "tempo", Effect: "gradient", Colors: []string{"#111111", "#222222", "#333333"}}, false},
		{"cor por nome", Style{Font: "tempo", Effect: "solid", Colors: []string{"red"}}, false},
		{"cor curta", Style{Font: "tempo", Effect: "solid", Colors: []string{"#fff"}}, false},
		{"css injetado", Style{Font: "tempo", Effect: "solid", Colors: []string{"#ffffff;background:url(x)"}}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Validate(tc.in)
			if tc.ok && err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if !tc.ok && !errors.Is(err, ErrInvalid) {
				t.Fatalf("err = %v, want ErrInvalid", err)
			}
		})
	}
}

func TestValidateNormalizes(t *testing.T) {
	got, err := Validate(Style{Font: "default", Effect: "solid", Colors: []string{"#A1B2C3"}})
	if err != nil || got.Colors[0] != "#a1b2c3" {
		t.Fatalf("got %+v, err %v", got, err)
	}
	got, _ = Validate(Style{Font: "default", Effect: "solid"})
	if got.Colors == nil {
		t.Fatal("Colors não pode ser nil (vira null no JSON)")
	}
}

func TestExpr(t *testing.T) {
	e := Expr("u")
	for _, want := range []string{"u.name_font", "u.name_effect", "u.name_colors"} {
		if !strings.Contains(e, want) {
			t.Fatalf("Expr(%q) = %s, falta %s", "u", e, want)
		}
	}
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && go test ./internal/namestyle/ -v`
Expected: FAIL (pacote não compila: `Style`, `Validate`... indefinidos).

- [ ] **Step 3: Escrever a migração**

`backend/migrations/000047_user_name_style.up.sql`:

```sql
-- Estilo do nome de exibição (fonte + efeito + cores), como no Discord.
-- Só acrescenta colunas com padrão: o binário anterior continua funcionando.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name_font TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS name_effect TEXT NOT NULL DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS name_colors TEXT[] NOT NULL DEFAULT '{}';
```

`backend/migrations/000047_user_name_style.down.sql`:

```sql
ALTER TABLE users
  DROP COLUMN IF EXISTS name_font,
  DROP COLUMN IF EXISTS name_effect,
  DROP COLUMN IF EXISTS name_colors;
```

- [ ] **Step 4: Implementar o pacote**

`backend/internal/namestyle/namestyle.go`:

```go
// Package namestyle é o estilo do nome de exibição: fonte, efeito e cores.
// Os IDs daqui têm de ser os mesmos do app (frontend lib/nameStyle.ts; um teste
// de lá confere as duas listas).
package namestyle

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
)

var ErrInvalid = errors.New("estilo de nome inválido")

var Fonts = []string{
	"default", "tempo", "sakura", "jellybean", "modern", "medieval", "bit8", "vampyre",
	"handwritten", "slab", "condensed", "mono", "retro",
}

var Effects = []string{"solid", "gradient", "neon", "toon", "pop", "rainbow", "pulse"}

const maxColors = 2

// minColors: quantas cores o efeito exige. Os que não estão aqui não exigem.
var minColors = map[string]int{"gradient": 2, "neon": 1, "toon": 1, "pop": 1}

var colorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type Style struct {
	Font   string   `json:"font"`
	Effect string   `json:"effect"`
	Colors []string `json:"colors"`
}

func Default() Style {
	return Style{Font: "default", Effect: "solid", Colors: []string{}}
}

func invalid(msg string) error {
	return fmt.Errorf("%w: %s", ErrInvalid, msg)
}

// Validate confere os IDs e as cores e devolve o estilo arrumado (cores em
// minúsculas, Colors nunca nil).
func Validate(s Style) (Style, error) {
	if !slices.Contains(Fonts, s.Font) {
		return Style{}, invalid("fonte desconhecida")
	}
	if !slices.Contains(Effects, s.Effect) {
		return Style{}, invalid("efeito desconhecido")
	}
	if len(s.Colors) > maxColors {
		return Style{}, invalid(fmt.Sprintf("use até %d cores", maxColors))
	}
	if len(s.Colors) < minColors[s.Effect] {
		return Style{}, invalid("o efeito escolhido precisa de mais cores")
	}
	out := Style{Font: s.Font, Effect: s.Effect, Colors: make([]string, 0, len(s.Colors))}
	for _, c := range s.Colors {
		if !colorPattern.MatchString(c) {
			return Style{}, invalid("cor inválida")
		}
		out.Colors = append(out.Colors, strings.ToLower(c))
	}
	return out, nil
}

// Expr é a expressão SQL que monta o JSON do estilo de quem está em `alias`
// (a tabela users). Escaneia direto num namestyle.Style.
func Expr(alias string) string {
	return fmt.Sprintf(
		`jsonb_build_object('font', %[1]s.name_font, 'effect', %[1]s.name_effect, 'colors', to_jsonb(%[1]s.name_colors))`,
		alias,
	)
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && go test ./internal/namestyle/ -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/000047_user_name_style.* backend/internal/namestyle
git commit -m "feat: colunas e validação do estilo do nome de exibição"
```

---

### Task 2: Estilo no perfil (validar, gravar, devolver)

**Files:**
- Modify: `backend/internal/user/model.go` (struct `User`, `PublicProfile`, `Public`)
- Modify: `backend/internal/user/profile.go` (`ProfileInput`, `ValidateProfile`)
- Modify: `backend/internal/user/repository.go` (`userColumns`, `scanUser`, `UpdateProfile`, `SearchByUsername`)
- Test: `backend/internal/user/profile_test.go`, `backend/internal/user/profile_handler_test.go`

**Interfaces:**
- Consumes: `namestyle.Style`, `namestyle.Validate`, `namestyle.Expr` (Task 1)
- Produces:
  - `User.NameStyle namestyle.Style` (json `name_style`) e `PublicProfile.NameStyle` (json `name_style`)
  - `ProfileInput.NameStyle *namestyle.Style` (json `name_style`; nil = não mexe)

- [ ] **Step 1: Escrever os testes que falham**

Em `profile_test.go`, acrescentar ao fim:

```go
func TestValidateProfileNameStyle(t *testing.T) {
	in := validInput()
	in.NameStyle = &namestyle.Style{Font: "medieval", Effect: "gradient", Colors: []string{"#FF0000", "#0000FF"}}
	out, err := ValidateProfile(in)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if out.NameStyle == nil || out.NameStyle.Colors[0] != "#ff0000" {
		t.Fatalf("estilo = %+v", out.NameStyle)
	}

	in.NameStyle = &namestyle.Style{Font: "comic", Effect: "solid"}
	if _, err := ValidateProfile(in); !errors.Is(err, ErrInvalidProfile) {
		t.Fatalf("err = %v, want ErrInvalidProfile", err)
	}

	in.NameStyle = nil
	out, err = ValidateProfile(in)
	if err != nil || out.NameStyle != nil {
		t.Fatalf("sem estilo deve continuar nil: %+v, %v", out.NameStyle, err)
	}
}
```

Importar `"gin-quickstart/backend/internal/namestyle"` no topo do arquivo de teste.

Em `profile_handler_test.go`, no `fakeProfileRepo.UpdateProfile`, depois da linha `u.BannerColor, u.Links = ...`, acrescentar:

```go
	if in.NameStyle != nil {
		u.NameStyle = *in.NameStyle
	}
```

e acrescentar o teste:

```go
func TestUpdateProfileNameStyle(t *testing.T) {
	e := newProfileEnv(t)
	body := `{"display_name":"Mugis","links":[],"name_style":{"font":"bit8","effect":"neon","colors":["#00FFAA"]}}`
	rec := e.do(t, http.MethodPut, "/api/users/me/profile", []byte(body), "application/json")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	u := decodeUser(t, rec)
	if u.NameStyle.Font != "bit8" || u.NameStyle.Effect != "neon" || u.NameStyle.Colors[0] != "#00ffaa" {
		t.Fatalf("name_style = %+v", u.NameStyle)
	}
	if e.events.published[0].NameStyle.Font != "bit8" {
		t.Fatalf("o evento público tem de levar o estilo: %+v", e.events.published[0])
	}

	// Cliente antigo (sem name_style) não apaga o estilo.
	rec = e.do(t, http.MethodPut, "/api/users/me/profile", []byte(`{"display_name":"Mugis","links":[]}`), "application/json")
	if rec.Code != http.StatusOK || decodeUser(t, rec).NameStyle.Font != "bit8" {
		t.Fatalf("estilo foi perdido: %s", rec.Body.String())
	}

	rec = e.do(t, http.MethodPut, "/api/users/me/profile", []byte(`{"display_name":"Mugis","links":[],"name_style":{"font":"x","effect":"solid","colors":[]}}`), "application/json")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && go test ./internal/user/ -run "NameStyle" -v`
Expected: FAIL (campos `NameStyle` indefinidos).

- [ ] **Step 3: Implementar o modelo**

Em `model.go`: importar `"gin-quickstart/backend/internal/namestyle"`; na struct `User`, depois de `Status string \`json:"status"\``, acrescentar:

```go
	NameStyle namestyle.Style `json:"name_style"`
```

Na struct `PublicProfile`, depois de `Status`, acrescentar `NameStyle namestyle.Style \`json:"name_style"\``, e em `Public(...)` o campo `NameStyle: u.NameStyle,`.

- [ ] **Step 4: Implementar a validação**

Em `profile.go`: importar `namestyle`; em `ProfileInput` acrescentar:

```go
	// NameStyle nil = não mexe (cliente antigo não manda o campo).
	NameStyle *namestyle.Style `json:"name_style"`
```

Em `ValidateProfile`, logo antes do `return out, nil` final:

```go
	if in.NameStyle != nil {
		style, err := namestyle.Validate(*in.NameStyle)
		if err != nil {
			return ProfileInput{}, invalid(err.Error())
		}
		out.NameStyle = &style
	}
```

- [ ] **Step 5: Implementar o repositório**

Em `repository.go`:

1. `userColumns`: acrescentar `name_font, name_effect, name_colors,` logo depois de `status,`. Em `scanUser`, acrescentar `&user.NameStyle.Font, &user.NameStyle.Effect, &user.NameStyle.Colors,` na mesma posição (depois de `&user.Status`).
2. `UpdateProfile`: trocar a query e os argumentos por

```go
		UPDATE users
		SET display_name = $2, pronouns = $3, bio = $4, status_text = $5,
			banner_color = $6, links = $7,
			name_font = COALESCE($8, name_font),
			name_effect = COALESCE($9, name_effect),
			name_colors = COALESCE($10, name_colors),
			updated_at = NOW()
		WHERE id = $1
		RETURNING `+userColumns,
		id,
		in.DisplayName,
		in.Pronouns,
		in.Bio,
		in.StatusText,
		in.BannerColor,
		in.Links,
		styleFont(in.NameStyle),
		styleEffect(in.NameStyle),
		styleColors(in.NameStyle),
```

e, no fim do arquivo, os helpers:

```go
func styleFont(s *namestyle.Style) *string {
	if s == nil {
		return nil
	}
	return &s.Font
}

func styleEffect(s *namestyle.Style) *string {
	if s == nil {
		return nil
	}
	return &s.Effect
}

// styleColors: nil vira NULL (COALESCE mantém); um slice vazio grava '{}'.
func styleColors(s *namestyle.Style) []string {
	if s == nil {
		return nil
	}
	return s.Colors
}
```

3. `SearchByUsername`: acrescentar `name_font, name_effect, name_colors,` ao SELECT (depois de `avatar_url,`) e `&u.NameStyle.Font, &u.NameStyle.Effect, &u.NameStyle.Colors,` ao Scan (depois de `&u.AvatarURL`).
4. Importar `"gin-quickstart/backend/internal/namestyle"`.

Obs.: `Create` (cadastro) não muda: as colunas têm padrão; a pessoa recém-criada tem `NameStyle{}` vazio no struct, e o frontend trata vazio como padrão.

- [ ] **Step 6: Rodar tudo do pacote e ver passar**

Run: `cd backend && go build ./... && go test ./internal/user/ ./internal/namestyle/`
Expected: PASS (outros pacotes compilam: o struct só ganhou campos).

- [ ] **Step 7: Commit**

```bash
git add backend/internal/user
git commit -m "feat: gravar e devolver o estilo do nome no perfil"
```

---

### Task 3: Estilo nas mensagens, membros, DMs, amigos e chamadas

**Files:**
- Modify: `backend/internal/message/model.go`, `backend/internal/message/repository.go`
- Modify: `backend/internal/server/model.go`, `backend/internal/server/repository.go`
- Modify: `backend/internal/conversation/model.go`, `backend/internal/conversation/repository.go`
- Modify: `backend/internal/friendship/repository.go`
- Modify: `backend/internal/call/model.go`, `backend/internal/call/service.go`

**Interfaces:**
- Consumes: `namestyle.Style`, `namestyle.Expr(alias)` (Task 1); `user.User.NameStyle` (Task 2)
- Produces: campo JSON `name_style` em `message.Author`, `server.ServerMember`, `conversation.OtherUser`, `call.UserInfo` (e já em `user.User`, que cobre amigos/bloqueados/em comum)

Não há como rodar essas queries sem banco; a verificação é compilar, rodar os testes de unidade existentes e conferir as colunas na ordem do `Scan`. Erro de ordem só aparece em runtime, então cada passo diz exatamente a posição.

- [ ] **Step 1: message — modelo**

Em `message/model.go`, importar `namestyle` e acrescentar em `Author`, depois de `AvatarURL`:

```go
	NameStyle   namestyle.Style `json:"name_style"`
```

- [ ] **Step 2: message — queries**

Em `message/repository.go`:

1. `messageColumns`: depois de `u.avatar_url,` inserir `` ` + namestyle.Expr("u") + `, ``; depois de `ru.avatar_url,` inserir `` ` + namestyle.Expr("ru") + `, ``. (`messageColumns` vira uma expressão de concatenação; se for `const`, trocar para `var messageColumns = ...`.)
2. Nos dois `Scan` (`FindByID` e `scanMessages`): depois de `&msg.Author.AvatarURL,` acrescentar `&msg.Author.NameStyle,`; depois de `&replyAvatarURL,` acrescentar `&replyStyle,`. Declarar `var replyStyle namestyle.Style` junto de `replyAvatarURL` nos dois lugares.
3. Nos dois `Author: &Author{...}` da resposta, acrescentar `NameStyle: replyStyle,`.
4. Procurar outros usos de `messageColumns` (`grep -n messageColumns backend/internal/message/*.go`) e conferir que todos passam pelos dois `Scan` acima. Se algum tiver Scan próprio, aplicar a mesma inserção.

- [ ] **Step 3: server — membros**

Em `server/model.go` importar `namestyle` e acrescentar em `ServerMember`, depois de `AvatarURL`: `NameStyle namestyle.Style \`json:"name_style"\``.

Em `server/repository.go`, em `ListMembers` **e** `FindMemberByUserID` (mesmas colunas): depois de `u.avatar_url,` inserir `` `+namestyle.Expr("u")+`, `` e, nos `Scan`, depois de `&m.AvatarURL,` acrescentar `&m.NameStyle,`. Conferir `service.go:80,303,366` (`member := &ServerMember{}`): são montagens em memória; se copiarem campos de `user`, acrescentar `NameStyle: u.NameStyle`.

- [ ] **Step 4: conversation**

Em `conversation/model.go` importar `namestyle` e acrescentar em `OtherUser` depois de `AvatarURL`: `NameStyle namestyle.Style \`json:"name_style"\``.

Em `conversation/repository.go`:
- `Members` (linha ~196): `SELECT u.id, u.username, u.display_name, u.avatar_url, `+namestyle.Expr("u")+`` e `Scan(&m.ID, &m.Username, &m.DisplayName, &m.AvatarURL, &m.NameStyle)`.
- `ListByUserID` (json_agg, linha ~349): depois de `'avatar_url', u.avatar_url` acrescentar `, 'name_style', `+namestyle.Expr("u")+``. O JSON desce direto para `OtherUser.NameStyle` no `json.Unmarshal`.
- Procurar o outro lugar que preenche `OtherUser` da DM 1:1 (`grep -n "OtherUser" backend/internal/conversation/*.go`) e acrescentar o estilo do mesmo jeito.

- [ ] **Step 5: friendship (amigos, bloqueados, em comum)**

Em `friendship/repository.go`, nas três queries que alimentam `user.User` (`ListFriends`, `ListBlocked`, `MutualFriends`): depois de `u.avatar_url` acrescentar `, u.name_font, u.name_effect, u.name_colors` no SELECT; nos Scans (inline de `ListFriends` e em `listUsers`), depois de `&u.AvatarURL,` acrescentar `&u.NameStyle.Font, &u.NameStyle.Effect, &u.NameStyle.Colors,`. `ListPending`/`ListSent` (`PendingRequest`) ficam sem estilo nesta entrega (cai no padrão).

- [ ] **Step 6: call**

Em `call/model.go` importar `namestyle` e acrescentar em `UserInfo` depois de `AvatarURL`: `NameStyle namestyle.Style \`json:"name_style"\``. Em `call/service.go`, `userInfo` (linha ~1214): acrescentar `NameStyle: u.NameStyle,`.

- [ ] **Step 7: Compilar e rodar os testes de unidade**

Run: `cd backend && go build ./... && go vet ./... && go test ./... 2>&1 | tail -30`
Expected: compila; testes que dependem de banco são pulados; nenhum teste de unidade novo falha. Se um teste existente comparar JSON exato de `Author`/`ServerMember`, atualizar o esperado para incluir `"name_style"`.

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "feat: estilo do nome em mensagens, membros, DMs, amigos e chamadas"
```

---

### Task 4: Catálogo do frontend (`lib/nameStyle.ts`) e paridade com o Go

**Files:**
- Create: `frontend/src/renderer/src/lib/nameStyle.ts`
- Test: `frontend/src/renderer/src/lib/nameStyle.test.ts`

**Interfaces:**
- Produces:
  - `type NameStyle = { font: string; effect: string; colors: string[] }`
  - `NAME_FONTS: readonly { id: string; label: string; family: string }[]`, `NAME_EFFECTS: readonly { id: string; label: string; minColors: number; maxColors: number }[]`
  - `DEFAULT_NAME_STYLE: NameStyle`
  - `resolveNameStyle(raw?: Partial<NameStyle> | null): NameStyle` — ID desconhecido/vazio vira o padrão; cores inválidas são descartadas
  - `nameStyleCss(style: NameStyle): { className: string; style: React.CSSProperties }`
  - `defaultColorsFor(effectId: string): string[]`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NAME_STYLE,
  NAME_EFFECTS,
  NAME_FONTS,
  defaultColorsFor,
  nameStyleCss,
  resolveNameStyle
} from './nameStyle'

// Lê as listas de IDs do Go: se alguém adicionar uma fonte/efeito só de um lado, quebra aqui.
function goList(name: 'Fonts' | 'Effects'): string[] {
  const file = resolve(__dirname, '../../../../../backend/internal/namestyle/namestyle.go')
  const src = readFileSync(file, 'utf8')
  const body = new RegExp(`var ${name} = \\[\\]string\\{([^}]*)\\}`).exec(src)?.[1] ?? ''
  return Array.from(body.matchAll(/"([a-z0-9]+)"/g), (m) => m[1])
}

describe('paridade com o backend', () => {
  it('as fontes são as mesmas', () => {
    expect(NAME_FONTS.map((f) => f.id)).toEqual(goList('Fonts'))
  })
  it('os efeitos são os mesmos', () => {
    expect(NAME_EFFECTS.map((e) => e.id)).toEqual(goList('Effects'))
  })
})

describe('resolveNameStyle', () => {
  it('vazio ou ausente vira o padrão', () => {
    expect(resolveNameStyle(undefined)).toEqual(DEFAULT_NAME_STYLE)
    expect(resolveNameStyle({ font: '', effect: '', colors: null as never })).toEqual(
      DEFAULT_NAME_STYLE
    )
  })
  it('ID desconhecido cai no padrão e mantém o que é válido', () => {
    expect(resolveNameStyle({ font: 'nope', effect: 'neon', colors: ['#00ffaa'] })).toEqual({
      font: 'default',
      effect: 'neon',
      colors: ['#00ffaa']
    })
  })
  it('descarta cor inválida (nunca vira CSS)', () => {
    const s = resolveNameStyle({ font: 'tempo', effect: 'solid', colors: ['red;x:y', '#abc'] })
    expect(s.colors).toEqual([])
  })
  it('efeito que exige cores sem elas volta para sólido', () => {
    expect(resolveNameStyle({ font: 'tempo', effect: 'gradient', colors: ['#ff0000'] }).effect).toBe(
      'solid'
    )
  })
})

describe('nameStyleCss', () => {
  it('padrão não muda nada', () => {
    expect(nameStyleCss(DEFAULT_NAME_STYLE)).toEqual({ className: '', style: {} })
  })
  it('fonte entra como font-family', () => {
    const { style } = nameStyleCss({ font: 'bit8', effect: 'solid', colors: [] })
    expect(style.fontFamily).toContain('Press Start 2P')
  })
  it('degradê usa as duas cores e recorta no texto', () => {
    const { style } = nameStyleCss({ font: 'default', effect: 'gradient', colors: ['#ff0000', '#0000ff'] })
    expect(style.backgroundImage).toContain('#ff0000')
    expect(style.backgroundImage).toContain('#0000ff')
    expect(style.WebkitBackgroundClip).toBe('text')
  })
  it('neon usa text-shadow com a cor', () => {
    const { style } = nameStyleCss({ font: 'default', effect: 'neon', colors: ['#00ffaa'] })
    expect(String(style.textShadow)).toContain('#00ffaa')
  })
  it('arco-íris e pulso usam classe (animação)', () => {
    expect(nameStyleCss({ font: 'default', effect: 'rainbow', colors: [] }).className).toBe('name-rainbow')
    expect(nameStyleCss({ font: 'default', effect: 'pulse', colors: ['#ff00ff'] }).className).toBe('name-pulse')
  })
})

describe('defaultColorsFor', () => {
  it('devolve o mínimo de cores que o efeito exige', () => {
    expect(defaultColorsFor('solid')).toEqual([])
    expect(defaultColorsFor('gradient')).toHaveLength(2)
    expect(defaultColorsFor('neon')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/renderer/src/lib/nameStyle.test.ts`
Expected: FAIL (módulo `./nameStyle` não existe).

- [ ] **Step 3: Implementar o catálogo**

```ts
import type { CSSProperties } from 'react'

// Estilo do nome de exibição. Os IDs são os do backend (internal/namestyle);
// nameStyle.test.ts confere as duas listas. As fontes são equivalentes livres
// (OFL) das do Discord, empacotadas em assets/nameFonts.css.

export interface NameStyle {
  font: string
  effect: string
  colors: string[]
}

export const DEFAULT_NAME_STYLE: NameStyle = { font: 'default', effect: 'solid', colors: [] }

export const NAME_FONTS = [
  { id: 'default', label: 'Padrão', family: '' },
  { id: 'tempo', label: 'Tempo', family: "'Bitter', serif" },
  { id: 'sakura', label: 'Sakura', family: "'Pacifico', cursive" },
  { id: 'jellybean', label: 'Jellybean', family: "'Chango', sans-serif" },
  { id: 'modern', label: 'Moderna', family: "'Montserrat', sans-serif" },
  { id: 'medieval', label: 'Medieval', family: "'Cinzel Decorative', serif" },
  { id: 'bit8', label: '8Bit', family: "'Press Start 2P', monospace" },
  { id: 'vampyre', label: 'Vampiro', family: "'Grenze Gotisch', serif" },
  { id: 'handwritten', label: 'Manuscrita', family: "'Caveat', cursive" },
  { id: 'slab', label: 'Slab', family: "'Zilla Slab', serif" },
  { id: 'condensed', label: 'Condensada', family: "'Oswald', sans-serif" },
  { id: 'mono', label: 'Monoespaçada', family: "'JetBrains Mono', monospace" },
  { id: 'retro', label: 'Retrô', family: "'Bungee', sans-serif" }
] as const

export const NAME_EFFECTS = [
  { id: 'solid', label: 'Sólido', minColors: 0, maxColors: 1 },
  { id: 'gradient', label: 'Degradê', minColors: 2, maxColors: 2 },
  { id: 'neon', label: 'Neon', minColors: 1, maxColors: 1 },
  { id: 'toon', label: 'Toon', minColors: 1, maxColors: 1 },
  { id: 'pop', label: 'Pop', minColors: 1, maxColors: 1 },
  { id: 'rainbow', label: 'Arco-íris', minColors: 0, maxColors: 0 },
  { id: 'pulse', label: 'Pulso', minColors: 0, maxColors: 1 }
] as const

const COLOR = /^#[0-9a-f]{6}$/i
const FALLBACK_COLORS = ['#5865f2', '#eb459e']

export function defaultColorsFor(effectId: string): string[] {
  const effect = NAME_EFFECTS.find((e) => e.id === effectId)
  return FALLBACK_COLORS.slice(0, effect?.minColors ?? 0)
}

/** Estilo seguro para desenhar: ID desconhecido vira o padrão, cor inválida some. */
export function resolveNameStyle(raw?: Partial<NameStyle> | null): NameStyle {
  const font = NAME_FONTS.some((f) => f.id === raw?.font) ? (raw!.font as string) : 'default'
  const effectDef = NAME_EFFECTS.find((e) => e.id === raw?.effect)
  const colors = (Array.isArray(raw?.colors) ? raw.colors : [])
    .filter((c): c is string => typeof c === 'string' && COLOR.test(c))
    .map((c) => c.toLowerCase())
    .slice(0, effectDef?.maxColors ?? 1)
  if (!effectDef || colors.length < effectDef.minColors) {
    return { font, effect: 'solid', colors: colors.slice(0, 1) }
  }
  return { font, effect: effectDef.id, colors }
}

/** Classe (animação) e estilo inline de um nome. O padrão não muda nada. */
export function nameStyleCss(style: NameStyle): { className: string; style: CSSProperties } {
  const family = NAME_FONTS.find((f) => f.id === style.font)?.family
  const css: CSSProperties = family ? { fontFamily: family } : {}
  const [a, b] = style.colors
  let className = ''
  switch (style.effect) {
    case 'solid':
      if (a) css.color = a
      break
    case 'gradient':
      css.backgroundImage = `linear-gradient(90deg, ${a}, ${b})`
      css.WebkitBackgroundClip = 'text'
      css.backgroundClip = 'text'
      css.color = 'transparent'
      break
    case 'neon':
      css.color = '#fff'
      css.textShadow = `0 0 4px ${a}, 0 0 10px ${a}, 0 0 18px ${a}`
      break
    case 'toon':
      css.color = a
      css.textShadow = '-1px -1px 0 #111, 1px -1px 0 #111, -1px 1px 0 #111, 1px 1px 0 #111'
      break
    case 'pop':
      css.color = '#fff'
      css.textShadow = `2px 2px 0 ${a}`
      break
    case 'rainbow':
      className = 'name-rainbow'
      break
    case 'pulse':
      className = 'name-pulse'
      if (a) css.color = a
      break
  }
  return { className, style: css }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/renderer/src/lib/nameStyle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/renderer/src/lib/nameStyle.*
git commit -m "feat: catálogo de fontes e efeitos do nome (com paridade com o backend)"
```

---

### Task 5: Fontes empacotadas, CSS dos efeitos e `<StyledName>`

**Files:**
- Modify: `frontend/package.json` (dependências)
- Create: `frontend/src/renderer/src/assets/nameFonts.css`, `frontend/src/renderer/src/assets/nameStyle.css`
- Create: `frontend/src/renderer/src/components/StyledName.tsx`
- Modify: `frontend/src/renderer/src/store/authStore.ts`, `frontend/src/renderer/src/api/users.ts` (tipos)
- Modify: `frontend/vite.renderer.shared.ts`, `frontend/electron-builder.yml` (licenças)
- Test: `frontend/src/renderer/src/components/StyledName.test.tsx`

**Interfaces:**
- Consumes: `resolveNameStyle`, `nameStyleCss`, `NameStyle` (Task 4); `useProfileStore` (existente)
- Produces: `<StyledName name: string, userId?: string, style?: Partial<NameStyle> | null, className?: string />` — se `userId` tem perfil no `profileStore`, usa o `name_style` dele; senão usa `style`; senão o padrão. Renderiza `<span>`.
- Tipos: `name_style?: NameStyle` em `PublicUser` (authStore) e `PublicProfile` (api/users).

- [ ] **Step 1: Instalar as fontes**

Run (cada nome deve existir; conferir antes de seguir):

```bash
cd frontend
for p in bitter pacifico chango montserrat cinzel-decorative press-start-2p grenze-gotisch caveat zilla-slab oswald jetbrains-mono bungee; do npm view @fontsource/$p version license; done
npx --yes yarn@1.22.22 add @fontsource/bitter @fontsource/pacifico @fontsource/chango @fontsource/montserrat @fontsource/cinzel-decorative @fontsource/press-start-2p @fontsource/grenze-gotisch @fontsource/caveat @fontsource/zilla-slab @fontsource/oswald @fontsource/jetbrains-mono @fontsource/bungee --ignore-scripts
```

Expected: todas com licença `OFL-1.1`. Se algum nome não existir ou a licença não for OFL, trocar por outra fonte OFL de estilo parecido e ajustar `family` em `nameStyle.ts`. Conferir que cada pacote tem o arquivo `latin-400.css` (`ls node_modules/@fontsource/<p>/latin-400.css`); se uma família só tiver outro peso (ex.: `latin-700.css`), importar esse.

- [ ] **Step 2: Escrever `assets/nameFonts.css`**

```css
/* Fontes do estilo de nome (lib/nameStyle.ts). Só o subset latin, um peso por
   família: o instalador não incha. Todas OFL; as licenças vão no build
   (vite.renderer.shared.ts). */
@import '@fontsource/bitter/latin-400.css';
@import '@fontsource/pacifico/latin-400.css';
@import '@fontsource/chango/latin-400.css';
@import '@fontsource/montserrat/latin-500.css';
@import '@fontsource/cinzel-decorative/latin-700.css';
@import '@fontsource/press-start-2p/latin-400.css';
@import '@fontsource/grenze-gotisch/latin-500.css';
@import '@fontsource/caveat/latin-500.css';
@import '@fontsource/zilla-slab/latin-500.css';
@import '@fontsource/oswald/latin-500.css';
@import '@fontsource/jetbrains-mono/latin-500.css';
@import '@fontsource/bungee/latin-400.css';
```

(Se o Step 1 mostrou outro peso disponível, ajustar o nome do arquivo.)

- [ ] **Step 3: Escrever `assets/nameStyle.css`**

```css
@import './nameFonts.css';

.name-rainbow {
  background-image: linear-gradient(90deg, #ff4d4d, #ffb84d, #f2ff4d, #4dff88, #4dc3ff, #b84dff, #ff4d4d);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: name-rainbow 4s linear infinite;
}

.name-pulse {
  animation: name-pulse 1.6s ease-in-out infinite;
}

@keyframes name-rainbow {
  to {
    background-position: 200% 0;
  }
}

@keyframes name-pulse {
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .name-rainbow,
  .name-pulse {
    animation: none;
  }
}
```

- [ ] **Step 4: Tipos**

Em `store/authStore.ts`: `import type { NameStyle } from '../lib/nameStyle'` e, em `PublicUser`, depois de `status?: ChosenStatus`: `name_style?: NameStyle`.
Em `api/users.ts`: `import type { NameStyle } from '../lib/nameStyle'` e, em `PublicProfile`, depois de `status: PresenceStatus`: `name_style?: NameStyle`.

- [ ] **Step 5: Escrever o teste do componente (falha)**

`components/StyledName.test.tsx` (usar o mesmo estilo dos outros testes `.tsx` do repo, ex. `AppErrorScreen.test.tsx`, para a ferramenta de render):

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import StyledName from './StyledName'
import { useProfileStore } from '../store/profileStore'

beforeEach(() => useProfileStore.getState().reset())

describe('StyledName', () => {
  it('sem estilo mostra só o nome', () => {
    expect(renderToStaticMarkup(<StyledName name="Mugis" />)).toContain('>Mugis<')
  })
  it('usa o estilo recebido', () => {
    const html = renderToStaticMarkup(
      <StyledName name="Mugis" style={{ font: 'bit8', effect: 'neon', colors: ['#00ffaa'] }} />
    )
    expect(html).toContain('Press Start 2P')
    expect(html).toContain('#00ffaa')
  })
  it('o perfil ao vivo ganha do estilo recebido', () => {
    useProfileStore.getState().apply({
      id: 'u1',
      username: 'm',
      display_name: 'Mugis',
      pronouns: '',
      bio: '',
      status_text: '',
      links: [],
      status: 'online',
      created_at: '',
      name_style: { font: 'tempo', effect: 'solid', colors: [] }
    })
    const html = renderToStaticMarkup(
      <StyledName
        name="Mugis"
        userId="u1"
        style={{ font: 'bit8', effect: 'solid', colors: [] }}
      />
    )
    expect(html).toContain('Bitter')
    expect(html).not.toContain('Press Start')
  })
})
```

Run: `cd frontend && npx vitest run src/renderer/src/components/StyledName.test.tsx`
Expected: FAIL (componente não existe).

- [ ] **Step 6: Implementar o componente**

```tsx
import { useProfileStore } from '../store/profileStore'
import { nameStyleCss, resolveNameStyle, type NameStyle } from '../lib/nameStyle'
import '../assets/nameStyle.css'

/**
 * Nome de exibição com a fonte/efeito que a pessoa escolheu. O estilo mais novo
 * vem do perfil conhecido (evento user:update); sem ele, vale o `style` que veio
 * junto com a mensagem/membro; sem nenhum, é o texto normal.
 * Só para o nome de exibição: apelido de servidor não leva estilo.
 */
export default function StyledName({
  name,
  userId,
  style,
  className = ''
}: {
  name: string
  userId?: string
  style?: Partial<NameStyle> | null
  className?: string
}): React.JSX.Element {
  const live = useProfileStore((s) => (userId ? s.profiles[userId]?.name_style : undefined))
  const resolved = resolveNameStyle(live ?? style)
  const css = nameStyleCss(resolved)
  const classes = [className, css.className].filter(Boolean).join(' ')
  return (
    <span className={classes || undefined} style={css.style}>
      {name}
    </span>
  )
}
```

- [ ] **Step 7: Licenças no build**

Em `vite.renderer.shared.ts`, a `fontLicensePlugin` emite só a licença da Outfit. Trocar `source` para concatenar a da Outfit com a de cada fonte nova, com um cabeçalho por pacote:

```ts
const NAME_FONT_PACKAGES = [
  'bitter', 'pacifico', 'chango', 'montserrat', 'cinzel-decorative', 'press-start-2p',
  'grenze-gotisch', 'caveat', 'zilla-slab', 'oswald', 'jetbrains-mono', 'bungee'
]
// ...dentro de generateBundle:
const licenses = [
  ['outfit', 'node_modules/@fontsource-variable/outfit/LICENSE'],
  ...NAME_FONT_PACKAGES.map((p) => [p, `node_modules/@fontsource/${p}/LICENSE`])
]
source: licenses.map(([n, f]) => `=== ${n} ===\n${readFileSync(resolve(f), 'utf8')}`).join('\n\n')
```

Em `electron-builder.yml`, acrescentar uma entrada `extraResources` por fonte (`from: node_modules/@fontsource/<p>/LICENSE`, `to: licenses/<p>-OFL.txt`), no mesmo formato da linha da Outfit. Se algum pacote não tiver `LICENSE`, usar o arquivo que existir (conferir com `ls`).

- [ ] **Step 8: Rodar testes e tipos**

Run: `cd frontend && npx vitest run src/renderer/src/components/StyledName.test.tsx src/renderer/src/lib/nameStyle.test.ts && npm run typecheck:web`
Expected: PASS.

- [ ] **Step 9: Conferir que o build empacota as fontes sem data-URI (CSP)**

Run (com o workaround do postcss da memória `concord-dev-env`): `cd frontend && npx electron-vite build` e depois `ls out/renderer/assets | grep -i -E "bitter|pacifico|press-start" | head` e `grep -c "data:font" out/renderer/assets/*.css`.
Expected: os `.woff2` aparecem como arquivos; `data:font` com contagem 0 (a CSP não tem `font-src`; cai em `default-src 'self'`, que bloqueia `data:`). Se aparecer `data:font`, definir `build.assetsInlineLimit: 0` para fontes em `vite.renderer.shared.ts`. Apagar o `postcss.config.mjs` temporário depois.

- [ ] **Step 10: Commit**

```bash
git add frontend
git commit -m "feat: fontes empacotadas e componente StyledName"
```

---

### Task 6: Editor de estilo em Configurações → Perfis

**Files:**
- Modify: `frontend/src/renderer/src/lib/profileValidation.ts`
- Modify: `frontend/src/renderer/src/api/users.ts` (`updateProfile`)
- Create: `frontend/src/renderer/src/components/settings/NameStyleEditor.tsx`
- Modify: `frontend/src/renderer/src/components/settings/sections/ProfilesSection.tsx`
- Test: `frontend/src/renderer/src/lib/profileValidation.test.ts` (existe; acrescentar)

**Interfaces:**
- Consumes: `NameStyle`, `NAME_FONTS`, `NAME_EFFECTS`, `resolveNameStyle`, `defaultColorsFor` (Task 4); `StyledName` (Task 5)
- Produces: `ProfileFields.name_style: NameStyle`; `NameStyleEditor({ value: NameStyle; previewName: string; onChange(next: NameStyle): void })`

- [ ] **Step 1: Teste que falha**

Em `lib/profileValidation.test.ts`, acrescentar (usar os helpers do arquivo para montar um rascunho; `draftFromProfile` é o ponto de entrada):

```ts
describe('estilo do nome no rascunho', () => {
  it('rascunho vem com o estilo salvo, ou o padrão', () => {
    expect(draftFromProfile({ display_name: 'a' }).name_style).toEqual(DEFAULT_NAME_STYLE)
    const saved = { font: 'tempo', effect: 'neon', colors: ['#00ffaa'] }
    expect(draftFromProfile({ display_name: 'a', name_style: saved }).name_style).toEqual(saved)
  })
  it('mudar só o estilo conta como alteração', () => {
    const base = draftFromProfile({ display_name: 'a' })
    const edited = { ...base, name_style: { font: 'bit8', effect: 'solid', colors: [] } }
    expect(fieldsChanged(base, edited)).toBe(true)
  })
})
```

(Importar `DEFAULT_NAME_STYLE` de `./nameStyle`. Se `fieldsChanged` tiver outra assinatura, abrir `profileValidation.ts` e usar a real.)

Run: `cd frontend && npx vitest run src/renderer/src/lib/profileValidation.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementar no rascunho**

Em `profileValidation.ts`: `import { DEFAULT_NAME_STYLE, resolveNameStyle, type NameStyle } from './nameStyle'`; em `ProfileFields` acrescentar `name_style: NameStyle`; em `draftFromProfile` (tipo do parâmetro com `name_style?: Partial<NameStyle> | null`) devolver `name_style: resolveNameStyle(profile.name_style)`; em `fieldsChanged` comparar `JSON.stringify(a.name_style) !== JSON.stringify(b.name_style)` junto das outras comparações; em `profilePayload`/onde o corpo do PUT é montado, incluir `name_style`. Ler o arquivo inteiro antes de editar para respeitar o padrão dos campos vizinhos.

Em `api/users.ts`, `updateProfile` já faz `...fields`, então `name_style` segue no corpo sem mudança.

- [ ] **Step 3: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/renderer/src/lib/profileValidation.test.ts`
Expected: PASS.

- [ ] **Step 4: Componente `NameStyleEditor`**

Seletor em grade (fontes e efeitos como botões com o próprio estilo aplicado), inputs de cor (`<input type="color">`) conforme `maxColors` do efeito, e prévia usando `StyledName`. Mesmas classes Tailwind do `ProfilesSection` (`inputClass`, `SecondaryButton`). Ao trocar de efeito: `colors` = cores atuais cortadas em `maxColors`, completadas com `defaultColorsFor(effect)` até `minColors`.

```tsx
import {
  NAME_EFFECTS,
  NAME_FONTS,
  defaultColorsFor,
  type NameStyle
} from '../../lib/nameStyle'
import StyledName from '../StyledName'

function withEffect(style: NameStyle, effectId: string): NameStyle {
  const def = NAME_EFFECTS.find((e) => e.id === effectId)
  if (!def) return style
  const kept = style.colors.slice(0, def.maxColors)
  const fill = defaultColorsFor(effectId).slice(kept.length)
  return { ...style, effect: effectId, colors: [...kept, ...fill] }
}

export default function NameStyleEditor({
  value,
  previewName,
  onChange
}: {
  value: NameStyle
  previewName: string
  onChange: (next: NameStyle) => void
}): React.JSX.Element {
  const effect = NAME_EFFECTS.find((e) => e.id === value.effect) ?? NAME_EFFECTS[0]
  const optionClass = (active: boolean): string =>
    `cursor-pointer rounded-md border px-3 py-2 text-left text-ds-sm text-white transition-colors ${
      active ? 'border-[#5865f2] bg-white/10' : 'border-white/10 bg-black/30 hover:bg-white/10'
    }`
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-black/40 px-4 py-3 text-lg text-white">
        <StyledName name={previewName || 'Seu nome'} style={value} />
      </div>
      <div>
        <p className="mb-2 text-xs text-gray-400">Fonte</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NAME_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={value.font === f.id}
              className={optionClass(value.font === f.id)}
              onClick={() => onChange({ ...value, font: f.id })}
            >
              <StyledName name={f.label} style={{ font: f.id, effect: 'solid', colors: [] }} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs text-gray-400">Efeito</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NAME_EFFECTS.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={value.effect === e.id}
              className={optionClass(value.effect === e.id)}
              onClick={() => onChange(withEffect(value, e.id))}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>
      {effect.maxColors > 0 && (
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400">
            {effect.maxColors > 1 ? 'Cores' : 'Cor'}
          </p>
          {Array.from({ length: effect.maxColors }, (_, i) => (
            <input
              key={i}
              type="color"
              aria-label={`Cor ${i + 1}`}
              value={value.colors[i] ?? '#5865f2'}
              onChange={(ev) => {
                const colors = [...value.colors]
                colors[i] = ev.target.value
                onChange({ ...value, colors })
              }}
              className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Encaixar no `ProfilesSection`**

Importar `NameStyleEditor`. Logo depois do `Field` do nome de exibição (linha ~224-235, o que usa `draft.display_name`), acrescentar:

```tsx
<Field label="Estilo do nome" hint="Fonte e efeito do seu nome de exibição.">
  <NameStyleEditor
    value={draft.name_style}
    previewName={draft.display_name.trim()}
    onChange={(next) => set('name_style', next)}
  />
</Field>
```

(`set` é a função que o campo vizinho já usa; conferir a assinatura e que aceita a chave `name_style`.) Na prévia do cartão (linha ~426, objeto com `display_name: draft.display_name.trim() || user.username`) acrescentar `name_style: draft.name_style`. Depois do salvar com sucesso, o `setUser` já recebe o `User` da API com `name_style`; conferir que o `profileStore.apply` do próprio usuário também é atualizado (se o fluxo atual já aplica o perfil novo, nada a fazer).

- [ ] **Step 6: Tipos e testes**

Run: `cd frontend && npm run typecheck:web && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "feat: editor de fonte e efeito do nome em Configurações → Perfis"
```

---

### Task 7: Usar `<StyledName>` onde o nome aparece

**Files (Modify):** em `frontend/src/renderer/src/`
- `api/messages.ts`, `api/servers.ts`, `api/conversations.ts`, `api/friends.ts`, `api/calls.ts`: acrescentar `name_style?: NameStyle` nos tipos que têm `display_name`
- `components/ChatPane.tsx` (autor da mensagem e da resposta)
- `components/profile/ProfileCardBody.tsx` (nome grande do cartão)
- `components/ServerSidebar.tsx` (lista de membros), `components/FriendsSidebar.tsx` (`DmName`)
- `components/call/ParticipantTile.tsx`, `components/call/DmCallView.tsx`, `components/call/IncomingCallModal.tsx`
- `components/UserBar.tsx`, `components/settings/sections/MyAccountSection.tsx`

**Regra única:** onde o nome mostrado é o nome de exibição (sem apelido de servidor), trocar o texto cru por `<StyledName name={…} userId={…} style={…} />`. Onde `serverDisplayName` devolveu um apelido (`member.nickname` preenchido), mostrar o texto sem estilo. Não tocar em `title=`, `aria-label`, menus de contexto, buscas, toasts e nomes dentro de texto corrido (esses ficam como string).

- [ ] **Step 1: Tipos da API**

Em cada arquivo de `api/` acima, `import type { NameStyle } from '../lib/nameStyle'` e acrescentar `name_style?: NameStyle` ao lado do `display_name` das interfaces de pessoa (autor da mensagem e da resposta, membro de servidor, `OtherUser`/membros de conversa, amigo, participante da chamada).

- [ ] **Step 2: ChatPane — autor da mensagem**

Em `ChatPane.tsx` (linhas ~255-262), trocar o `{name}` do botão do autor. O estilo só vale sem apelido:

```tsx
{nickname ? name : <StyledName name={name} userId={message.author_id} style={author?.name_style} />}
```

Fazer o mesmo no nome do autor da resposta (`replyAuthorName`, ~linha 197 e onde é renderizado), passando `message.reply_to?.author?.name_style` e `replyNickname`. Importar `StyledName` de `./StyledName`.

- [ ] **Step 3: Demais pontos**

Para cada arquivo restante: abrir, localizar o JSX que renderiza o nome (`grep -n "display_name" <arquivo>`), e aplicar a regra única. Guia por arquivo:
- `ProfileCardBody.tsx:149`: `{profile.nickname || profile.display_name || ' '}` → se `profile.nickname` existe, texto; senão `<StyledName name={profile.display_name || ' '} userId={profile.id} style={profile.name_style} />`. Adicionar `name_style?: NameStyle` ao tipo do perfil do cartão (linha ~18).
- `ServerSidebar.tsx` (lista de membros): usar o estilo do membro (`m.name_style`) só se `m.nickname` for vazio.
- `FriendsSidebar.tsx:119` (`DmName`): passar `style={other.name_style}` e `userId={other.id}`.
- `ParticipantTile.tsx:341`, `DmCallView.tsx:63`, `IncomingCallModal.tsx:79`: `<StyledName name={…} userId={…} style={….name_style} />`.
- `UserBar.tsx` e `MyAccountSection.tsx:44`: usar `useAuthStore` do usuário atual (`user.name_style`).

Manter classes e tamanho do elemento original (passar `className` do wrapper antigo para o `StyledName` quando o texto estava num `<span>`/`<p>` só com texto).

- [ ] **Step 4: Tipos, lint e testes**

Run: `cd frontend && npm run typecheck && npm run lint && npx vitest run`
Expected: PASS (testes existentes que fazem snapshot de nome continuam iguais porque o estilo padrão não muda a marcação, exceto pelo `<span>` extra; ajustar o que quebrar por isso).

- [ ] **Step 5: Verificação visual**

Seguir a memória `concord-dev-env` (harness Vite com Playwright `channel: 'chrome'`): renderizar `NameStyleEditor` e uma mensagem do `ChatPane` com cada fonte/efeito e olhar os screenshots (legibilidade, fonte carregou, sem corte de ascendentes no degradê/8Bit, `prefers-reduced-motion` para a animação). Registrar no PR o que foi visto.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: mostrar o estilo do nome em mensagens, listas, cartão e chamadas"
```

---

### Task 8: Verificação final e PR

- [ ] **Step 1:** `cd backend && go vet ./... && go test ./...` e `cd frontend && npm run typecheck && npm run lint && npx vitest run`. Tudo verde (testes de banco pulados sem Docker; dizer isso no PR).
- [ ] **Step 2:** Revisar `git diff origin/main --stat`; conferir que não entrou `postcss.config.mjs` temporário nem `.env`.
- [ ] **Step 3:** Seguir o git flow (memória `concord-git-flow`): `git push fork feat/fonte-apelido`, depois `gh pr create --repo hugoemannuel/concord --base develop --head caiolucio360:feat/fonte-apelido`. Corpo do PR em português, com o resumo, o que ficou fora (pendências de amizade, banidos, busca, menções `@`, estilo por servidor) e como testar. Sem atribuição de IA. **Confirmar com o usuário antes do push/PR.**
