# Enquete do segundo turno: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a
> tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** trocar o banner sim/não do #317 por uma enquete de escolha única
(Fez o L, Fez o 22 ou Prefiro não dizer), obrigatória, com modal genérico.

**Arquitetura:** a enquete é uma struct em Go (`internal/enquete`), as respostas
ficam em `escolhas(user_id, enquete, opcao)`, e os badges `l` e `v22` (categorias
exclusivas) leem `Stats.Escolhas`. O frontend tem `features/enquete` com store
próprio e um modal que só conhece "enquete com opções".

**Stack:** Go 1.26 (Gin + pgx), Postgres, React + Zustand + Tailwind v4, Vitest.
Sem dependência nova.

Spec: `docs/superpowers/specs/2026-10-27-enquete-badge-segundo-turno-design.md`.
Plano anterior (#317, ainda vale para o histórico): `2026-10-27-badge-l.md`.

## Restrições globais

- Corte da enquete: conta criada **antes de 2026-10-26 00:00 BRT** (`time.FixedZone("BRT", -3*60*60)`).
- Raridade dos badges `l` e `v22`: `RarityLegendary`, `Exclusive: true`, `Unit: UnitVote`.
- Status HTTP: 400 opção inválida ou corpo sem `opcao`, 401, 403 fora do corte, 404 enquete ou usuário inexistente, 409 já respondeu.
- Rotas: `GET /users/me/enquetes` e `POST /users/me/enquetes/:id` (corpo `{"opcao":"l"}`).
- Modal obrigatório: sem X, sem Esc, sem fechar clicando fora, foco preso. Celebração e aviso neutro fecham (botão, X, Esc, fora) e sozinhos em 6 s e 4,5 s.
- Textos (aprovados, copiar literalmente):
  - Título: "Escolha o seu badge do segundo turno"
  - Descrição: "Você já estava na Salinha no dia, então pode escolher um badge de lembrança. A escolha é definitiva."
  - Opções: "Fez o L", "Fez o 22", "Prefiro não dizer"
  - Botões: "Continuar", "Confirmar", "Voltar", "Fechar"
  - Confirmação: "Confirmar: {rótulo}?" e "Não dá para mudar depois."
  - Celebração: "Badge conquistado!" e o nome do badge
  - Neutra: "Tudo certo! Sua escolha foi guardada."
  - Erro: "Não foi possível enviar. Tente de novo."
  - Badges: "Fez o L" e "Fez o 22"; descrição "Fez o L no segundo turno. Ganho escolhendo o badge do segundo turno." (e "Fez o 22 ..." no outro)
- CRAP ≤ 15 em toda função tocada; nenhum god store ganha campo.
- Windows/CRLF: crie arquivos novos com a ferramenta Write; formate com `gofmt`/`prettier --end-of-line auto` só nos arquivos que você mudou; commite com caminhos explícitos (nunca `git add -A`). Go portátil: `export GO=/c/Users/Admin/AppData/Local/Temp/claude/C--Users-Admin-orca-concord/0b965887-2e45-4c09-9a2e-e149f80567e6/scratchpad/go/bin/go.exe`. O CRAP precisa de `frontend/postcss.config.mjs` temporário (`export default { plugins: [] }`), que **nunca** vai para um commit.
- Sem atribuição de IA em commits e PR.

## Estrutura de arquivos

Backend:

| Arquivo | Responsabilidade |
|---|---|
| `backend/migrations/000066_escolhas.{up,down}.sql` | tabela `escolhas` (troca a `000066_segundo_turno_respostas`) |
| `backend/internal/enquete/model.go` | tipos (`Enquete`, `Opcao`, `Conta`, `Resposta`) e erros |
| `backend/internal/enquete/definicoes.go` | `SegundoTurno` e `Todas` |
| `backend/internal/enquete/service.go` | `Pendentes` e `Responder` |
| `backend/internal/enquete/repository.go` | SQL (`Carregar`, `Gravar`) |
| `backend/internal/enquete/handler.go`, `routes.go` | HTTP |
| `backend/internal/badge/{catalog,evaluate,repository}.go` | `v22`, `Stats.Escolhas` |
| `backend/cmd/wire_engagement.go` | ligação |

Frontend (`frontend/src/renderer/src/`):

| Arquivo | Responsabilidade |
|---|---|
| `features/enquete/api/enquete.ts` | chamadas HTTP e tipos |
| `features/enquete/lib/enquete.ts` | fase, reação, textos puros |
| `features/enquete/store/enqueteStore.ts` | estado e fluxo |
| `features/enquete/hooks/useFecharEm.ts` | auto-fechar |
| `features/enquete/components/Enquete*.tsx` | camada, pergunta, confirmação, celebração, aviso neutro, host |
| `assets/enquete.css` | animações |
| `features/levels/lib/badges.ts` | `unlocksComAviso` ignora `l` e `v22` |
| `app/AppShell.tsx` | monta `EnqueteHost` |
| `features/servers/components/ServerRail.tsx` | volta ao original (sem botão "L") |

---

### Task 1: renomear o backend (`segundoturno` → `enquete`), só estrutura

**Files:**
- Move: `backend/internal/segundoturno/*` → `backend/internal/enquete/*`
- Modify: `backend/cmd/wire_engagement.go`

**Interfaces:**
- Produces: pacote `enquete` com os mesmos identificadores de hoje (os nomes mudam nas Tasks 4 e 5).

- [ ] **Step 1: mover e trocar o nome do pacote**

```bash
git mv backend/internal/segundoturno backend/internal/enquete
sed -i 's/^package segundoturno$/package enquete/' backend/internal/enquete/*.go
sed -i 's#internal/segundoturno"#internal/enquete"#; s#segundoturno\.#enquete.#g' backend/cmd/wire_engagement.go
sed -i 's/\[segundoturno\]/[enquete]/' backend/internal/enquete/handler.go
```

- [ ] **Step 2: compilar e testar (nada de comportamento muda)**

Run: `cd backend && "$GO" build ./... && "$GO" vet ./internal/enquete ./cmd && "$GO" test ./internal/enquete ./cmd`
Expected: PASS.

- [ ] **Step 3: commit**

```bash
git add backend/internal/enquete backend/internal/segundoturno backend/cmd/wire_engagement.go
git commit -m "refactor(enquete): pacote segundoturno vira enquete

Só renomeia; o comportamento muda nos próximos commits."
```

---

### Task 2: renomear o frontend (`features/segundoturno` → `features/enquete`), só estrutura

**Files:**
- Move: `frontend/src/renderer/src/features/segundoturno` → `.../features/enquete`
- Move: `frontend/src/renderer/src/assets/segundoTurno.css` → `.../assets/enquete.css`
- Modify: imports em `app/AppShell.tsx`, `features/servers/components/ServerRail.tsx` e nos arquivos movidos.

**Interfaces:**
- Produces: mesmos componentes e store de hoje, em `features/enquete`.

- [ ] **Step 1: mover e corrigir os caminhos**

```bash
cd frontend/src/renderer/src
git mv features/segundoturno features/enquete
git mv assets/segundoTurno.css assets/enquete.css
sed -i "s#assets/segundoTurno.css#assets/enquete.css#" features/enquete/components/SegundoTurnoCamada.tsx
sed -i "s#features/segundoturno/#features/enquete/#g" app/AppShell.tsx features/servers/components/ServerRail.tsx
```

- [ ] **Step 2: testes, tipos e prettier**

Run (em `frontend/`): `npx vitest run src/renderer/src/features/enquete && npm run typecheck && npx prettier --check --end-of-line auto src/renderer/src/features/enquete src/renderer/src/assets/enquete.css`
Expected: PASS (32 testes), tipos limpos.

- [ ] **Step 3: commit**

```bash
git add frontend/src/renderer/src/features frontend/src/renderer/src/assets frontend/src/renderer/src/app/AppShell.tsx
git commit -m "refactor(enquete): feature segundoturno vira enquete no frontend

Só renomeia pastas e imports; o comportamento muda nos próximos commits."
```

---

### Task 3: migration `escolhas` e badges `l`/`v22` por `Stats.Escolhas`

**Files:**
- Move+modify: `backend/migrations/000066_segundo_turno_respostas.{up,down}.sql` → `000066_escolhas.{up,down}.sql`
- Modify: `backend/internal/badge/catalog.go`, `evaluate.go`, `repository.go`, `evaluate_test.go`

**Interfaces:**
- Produces: `Stats.Escolhas map[string]bool` (chaves `"enquete:opcao"`), `escolhasSet([]string) map[string]bool` (privada), categorias `l` e `v22`.
- Consumes: tabela `escolhas(user_id, enquete, opcao)`.

- [ ] **Step 1: trocar os testes de `FezOL` e acrescentar o `v22` (falham)**

Em `backend/internal/badge/evaluate_test.go`, no teste `TestEvaluateLOnlyForWhoSaidYes` e em `TestEvaluateLKeepsDateOnceStored`, troque `FezOL: true` por `Escolhas: map[string]bool{"segundo-turno:l": true}`. Acrescente no fim do arquivo:

```go
func TestEvaluateV22OnlyForWhoChoseIt(t *testing.T) {
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, Escolhas: map[string]bool{"segundo-turno:l": true}}, nil, now)
	if hasBadge(badges, "v22") {
		t.Fatal("quem escolheu o L vê o badge do 22")
	}
	for _, u := range fresh {
		if u.Category == "v22" {
			t.Fatalf("quem escolheu o L desbloqueou o 22: %+v", u)
		}
	}

	badges, fresh = Evaluate(Stats{CreatedAt: FounderCutoff, Escolhas: map[string]bool{"segundo-turno:22": true}}, nil, now)
	b := find(t, badges, "v22")
	if b.Tier != 1 || b.TierName != "Fez o 22" || b.Rarity != RarityLegendary || b.Progress != 1 || b.NextThreshold != nil {
		t.Fatalf("badge v22 = %+v", b)
	}
	if hasBadge(badges, "l") {
		t.Fatal("quem escolheu o 22 vê o badge do L")
	}
	var got bool
	for _, u := range fresh {
		got = got || (u.Category == "v22" && u.Tier == 1)
	}
	if !got {
		t.Fatalf("fresh = %+v, want v22/1", fresh)
	}
}

func TestEvaluateNenhumNaoDaBadge(t *testing.T) {
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, Escolhas: map[string]bool{"segundo-turno:nenhum": true}}, nil, now)
	if hasBadge(badges, "l") || hasBadge(badges, "v22") {
		t.Fatal("quem preferiu não dizer ganhou badge")
	}
	for _, u := range fresh {
		if u.Category == "l" || u.Category == "v22" {
			t.Fatalf("desbloqueio indevido: %+v", u)
		}
	}
}

func TestEscolhasSet(t *testing.T) {
	got := escolhasSet([]string{"segundo-turno:l", "outra:x"})
	if !got["segundo-turno:l"] || !got["outra:x"] || got["segundo-turno:22"] || len(got) != 2 {
		t.Fatalf("escolhasSet = %v", got)
	}
	if got := escolhasSet(nil); got == nil || len(got) != 0 {
		t.Fatalf("escolhasSet(nil) = %v, quer mapa vazio", got)
	}
}
```

- [ ] **Step 2: ver falhar**

Run: `cd backend && "$GO" test ./internal/badge 2>&1 | head -8`
Expected: FAIL de compilação (`unknown field Escolhas`, `undefined: escolhasSet`).

- [ ] **Step 3: implementar**

`catalog.go`: logo depois da categoria `l`, acrescente:

```go
	{
		// Quem escolheu "Fez o 22" na enquete do segundo turno
		// (internal/enquete), com o mesmo peso do badge l.
		Key:         "v22",
		Name:        "Fez o 22",
		Description: "Fez o 22 no segundo turno. Ganho escolhendo o badge do segundo turno.",
		Unit:        UnitVote,
		Tiers: []Tier{
			{"Fez o 22", 1, RarityLegendary},
		},
		Exclusive: true,
	},
```

Na categoria `l`, troque a descrição por `"Fez o L no segundo turno. Ganho escolhendo o badge do segundo turno."` e o comentário por `// Quem escolheu "Fez o L" na enquete do segundo turno (internal/enquete).`

`evaluate.go`: na struct `Stats`, troque `FezOL bool` (e seu comentário) por:

```go
	// Escolhas da enquete ("enquete:opcao"), de internal/enquete.
	Escolhas map[string]bool
```

Na tabela `valueFns`, troque a linha do `"l"` por:

```go
	"l":            func(s Stats, _ time.Time) int64 { return flag(s.Escolhas["segundo-turno:l"]) },
	"v22":          func(s Stats, _ time.Time) int64 { return flag(s.Escolhas["segundo-turno:22"]) },
```

`repository.go`: em `Stats`, troque a linha do `EXISTS ... segundo_turno_respostas` por
`ARRAY(SELECT e.enquete || ':' || e.opcao FROM escolhas e WHERE e.user_id = u.id)`, declare `var escolhas []string` antes da query, troque `&s.FezOL,` por `&escolhas,` e, depois do `Scan` bem-sucedido (antes do `return`), faça `s.Escolhas = escolhasSet(escolhas)`. Acrescente no fim do arquivo:

```go
// escolhasSet vira a lista "enquete:opcao" num conjunto (nunca nil).
func escolhasSet(items []string) map[string]bool {
	out := make(map[string]bool, len(items))
	for _, it := range items {
		out[it] = true
	}
	return out
}
```

- [ ] **Step 4: trocar a migration**

```bash
cd backend/migrations
git mv 000066_segundo_turno_respostas.up.sql 000066_escolhas.up.sql
git mv 000066_segundo_turno_respostas.down.sql 000066_escolhas.down.sql
```

Conteúdo de `000066_escolhas.up.sql`:

```sql
-- Enquetes de escolha única (internal/enquete). A resposta é definitiva: uma
-- por pessoa por enquete. A opção pode conceder um badge exclusivo (ex.: "l" e
-- "22" do segundo turno, categorias l e v22 de internal/badge); as outras só
-- impedem a pergunta de voltar e não aparecem para ninguém.
CREATE TABLE escolhas (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    enquete TEXT NOT NULL,
    opcao TEXT NOT NULL,
    respondido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, enquete)
);
```

Conteúdo de `000066_escolhas.down.sql`: `DROP TABLE IF EXISTS escolhas;`

- [ ] **Step 5: ver passar e conferir**

Run: `cd backend && "$GO" fmt ./internal/badge >/dev/null; "$GO" vet ./internal/badge && "$GO" test ./internal/badge && cd .. && node scripts/check-migrations.mjs`
Expected: PASS e `migrations ok`. (`enquete` ainda compila: ela não usa `Stats`.)

- [ ] **Step 6: commit**

```bash
git add backend/migrations backend/internal/badge
git commit -m "feat(badge): categoria v22 e escolhas da enquete no lugar do booleano

Stats.Escolhas vem da tabela escolhas (troca a 000066 do #317, ainda sem
produção). L e 22 têm o mesmo peso; nenhum não gera badge."
```

---

### Task 4: serviço da enquete (definições, tipos, regras)

**Files:**
- Rewrite: `backend/internal/enquete/model.go`, `service.go`, `service_test.go`
- Create: `backend/internal/enquete/definicoes.go`

**Interfaces:**
- Produces:
  - `type Opcao struct{ID, Rotulo, Badge string}`, `type Enquete struct{ID, Titulo, Descricao string; Corte time.Time; Opcoes []Opcao}`
  - `type Conta struct{CriadaEm time.Time; Respostas map[string]string}`, `type Resposta struct{Enquete, Opcao, Badge string}`
  - erros `ErrEnqueteInexistente`, `ErrOpcaoInvalida`, `ErrNaoElegivel`, `ErrJaRespondeu`, `ErrUsuarioNaoEncontrado`
  - `var SegundoTurno Enquete`, `var Todas []Enquete`
  - `func EnqueteService(repository *Repository, badges BadgeRefresher, enquetes []Enquete) *Service`
  - `(*Service).Pendentes(ctx, userID) ([]Enquete, error)` e `(*Service).Responder(ctx, userID, enqueteID, opcaoID string) (Resposta, error)`
  - interface `store { Carregar(ctx, userID) (Conta, error); Gravar(ctx, userID, enquete, opcao string) (bool, error) }`

- [ ] **Step 1: escrever os testes (falham)** — substitua `service_test.go` por:

```go
package enquete

import (
	"context"
	"errors"
	"testing"
	"time"
)

var corte = time.Date(2026, 10, 26, 0, 0, 0, 0, time.UTC)

var enqueteTeste = Enquete{
	ID:    "teste",
	Corte: corte,
	Opcoes: []Opcao{
		{ID: "a", Rotulo: "A", Badge: "badge-a"},
		{ID: "nenhum", Rotulo: "Nenhum"},
	},
}

type fakeStore struct {
	contas  map[string]Conta
	gravado map[string]string
	// perdeCorrida simula outro pedido gravando antes (Gravar devolve false).
	perdeCorrida bool
	err          error
}

func (f *fakeStore) Carregar(_ context.Context, userID string) (Conta, error) {
	if f.err != nil {
		return Conta{}, f.err
	}
	c, ok := f.contas[userID]
	if !ok {
		return Conta{}, ErrUsuarioNaoEncontrado
	}
	return c, nil
}

func (f *fakeStore) Gravar(_ context.Context, userID, enquete, opcao string) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	if f.perdeCorrida {
		return false, nil
	}
	f.gravado[userID+"/"+enquete] = opcao
	return true, nil
}

type fakeRefresher struct {
	chamados []string
	// ctxErr é o erro do contexto que o Refresh recebeu.
	ctxErr error
}

func (f *fakeRefresher) Refresh(ctx context.Context, userID string) {
	f.chamados = append(f.chamados, userID)
	f.ctxErr = ctx.Err()
}

func novoServico(contas map[string]Conta) (*Service, *fakeStore, *fakeRefresher) {
	st := &fakeStore{contas: contas, gravado: map[string]string{}}
	rf := &fakeRefresher{}
	return &Service{store: st, badges: rf, enquetes: []Enquete{enqueteTeste}}, st, rf
}

func antes() Conta  { return Conta{CriadaEm: corte.Add(-time.Hour)} }
func depois() Conta { return Conta{CriadaEm: corte.Add(time.Hour)} }

func TestPendentesSoParaElegiveisQueNaoResponderam(t *testing.T) {
	respondida := antes()
	respondida.Respostas = map[string]string{"teste": "a"}
	s, _, _ := novoServico(map[string]Conta{
		"velha": antes(), "nova": depois(), "no-corte": {CriadaEm: corte}, "ja": respondida,
	})
	casos := map[string]int{"velha": 1, "nova": 0, "no-corte": 0, "ja": 0}
	for id, quer := range casos {
		got, err := s.Pendentes(context.Background(), id)
		if err != nil || len(got) != quer {
			t.Fatalf("%s: pendentes = %v, err = %v, quer %d", id, got, err, quer)
		}
		if got == nil {
			t.Fatalf("%s: pendentes nil (o JSON precisa ser [])", id)
		}
	}
}

func TestPendentesUsuarioInexistente(t *testing.T) {
	s, _, _ := novoServico(map[string]Conta{})
	if _, err := s.Pendentes(context.Background(), "ninguem"); !errors.Is(err, ErrUsuarioNaoEncontrado) {
		t.Fatalf("err = %v", err)
	}
}

func TestResponderComBadgeGravaEReavalia(t *testing.T) {
	s, st, rf := novoServico(map[string]Conta{"ana": antes()})
	got, err := s.Responder(context.Background(), "ana", "teste", "a")
	if err != nil {
		t.Fatal(err)
	}
	if got != (Resposta{Enquete: "teste", Opcao: "a", Badge: "badge-a"}) || st.gravado["ana/teste"] != "a" {
		t.Fatalf("resposta = %+v, gravado = %v", got, st.gravado)
	}
	if len(rf.chamados) != 1 || rf.chamados[0] != "ana" {
		t.Fatalf("Refresh chamado = %v, quer [ana]", rf.chamados)
	}
}

func TestResponderSemBadgeNaoMexeNosBadges(t *testing.T) {
	s, st, rf := novoServico(map[string]Conta{"ana": antes()})
	got, err := s.Responder(context.Background(), "ana", "teste", "nenhum")
	if err != nil {
		t.Fatal(err)
	}
	if got.Badge != "" || st.gravado["ana/teste"] != "nenhum" {
		t.Fatalf("resposta = %+v, gravado = %v", got, st.gravado)
	}
	if len(rf.chamados) != 0 {
		t.Fatalf("Refresh não devia ser chamado: %v", rf.chamados)
	}
}

func TestResponderRecusa(t *testing.T) {
	respondida := antes()
	respondida.Respostas = map[string]string{"teste": "a"}
	casos := []struct {
		nome  string
		conta Conta
		enq   string
		opcao string
		store func(*fakeStore)
		erro  error
	}{
		{"conta depois do corte", depois(), "teste", "a", nil, ErrNaoElegivel},
		{"já respondeu", respondida, "teste", "a", nil, ErrJaRespondeu},
		{"outro pedido gravou antes", antes(), "teste", "a", func(f *fakeStore) { f.perdeCorrida = true }, ErrJaRespondeu},
		{"enquete inexistente", antes(), "outra", "a", nil, ErrEnqueteInexistente},
		{"opção inexistente", antes(), "teste", "zzz", nil, ErrOpcaoInvalida},
		{"falha do banco", antes(), "teste", "a", func(f *fakeStore) { f.err = errors.New("db down") }, nil},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			s, st, rf := novoServico(map[string]Conta{"ana": c.conta})
			if c.store != nil {
				c.store(st)
			}
			_, err := s.Responder(context.Background(), "ana", c.enq, c.opcao)
			if err == nil || (c.erro != nil && !errors.Is(err, c.erro)) {
				t.Fatalf("err = %v, quer %v", err, c.erro)
			}
			if len(st.gravado) != 0 || len(rf.chamados) != 0 {
				t.Fatalf("não devia gravar nem reavaliar: %v %v", st.gravado, rf.chamados)
			}
		})
	}
}

func TestResponderUsuarioInexistente(t *testing.T) {
	s, _, _ := novoServico(map[string]Conta{})
	if _, err := s.Responder(context.Background(), "ninguem", "teste", "a"); !errors.Is(err, ErrUsuarioNaoEncontrado) {
		t.Fatalf("err = %v", err)
	}
}

// Se quem pediu desconectar logo depois de gravar, o badge ainda tem que sair.
func TestResponderReavaliaMesmoComPedidoCancelado(t *testing.T) {
	s, _, rf := novoServico(map[string]Conta{"ana": antes()})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.Responder(ctx, "ana", "teste", "a"); err != nil {
		t.Fatal(err)
	}
	if len(rf.chamados) != 1 || rf.ctxErr != nil {
		t.Fatalf("Refresh chamado = %v, ctx.Err() = %v, quer 1 chamada com contexto vivo", rf.chamados, rf.ctxErr)
	}
}

func TestDefinicaoDoSegundoTurno(t *testing.T) {
	e := SegundoTurno
	if e.ID != "segundo-turno" || len(Todas) != 1 || Todas[0].ID != e.ID {
		t.Fatalf("definição = %+v, Todas = %v", e, Todas)
	}
	quer := map[string]string{"l": "l", "22": "v22", "nenhum": ""}
	if len(e.Opcoes) != len(quer) {
		t.Fatalf("opções = %+v", e.Opcoes)
	}
	for _, o := range e.Opcoes {
		if b, ok := quer[o.ID]; !ok || o.Badge != b || o.Rotulo == "" {
			t.Fatalf("opção %+v inesperada", o)
		}
	}
	// Quem criou a conta no dia 25 (23:59 em Brasília) entra; no dia 26 não.
	brt := time.FixedZone("BRT", -3*60*60)
	if !time.Date(2026, 10, 25, 23, 59, 0, 0, brt).Before(e.Corte) || time.Date(2026, 10, 26, 0, 0, 0, 0, brt).Before(e.Corte) {
		t.Fatalf("corte = %v", e.Corte)
	}
}
```


- [ ] **Step 2: ver falhar**

Run: `cd backend && "$GO" test ./internal/enquete 2>&1 | head -6`
Expected: FAIL de compilação (`undefined: Enquete`, `Conta` com campos novos...).

- [ ] **Step 3: implementar** — substitua `model.go` e `service.go` e crie `definicoes.go`:

`model.go`:

```go
package enquete

import (
	"errors"
	"time"
)

var (
	ErrEnqueteInexistente   = errors.New("enquete não encontrada")
	ErrOpcaoInvalida        = errors.New("opção inválida")
	ErrNaoElegivel          = errors.New("conta fora do corte da enquete")
	ErrJaRespondeu          = errors.New("enquete já respondida")
	ErrUsuarioNaoEncontrado = errors.New("user not found")
)

// Opcao é uma resposta possível. Badge é a categoria concedida a quem a
// escolhe (internal/badge); vazio = nenhum badge.
type Opcao struct {
	ID     string `json:"id"`
	Rotulo string `json:"rotulo"`
	Badge  string `json:"badge,omitempty"`
}

// Enquete é uma pergunta de escolha única, definida em código (definicoes.go).
type Enquete struct {
	ID        string `json:"id"`
	Titulo    string `json:"titulo"`
	Descricao string `json:"descricao"`
	// Corte: só contas criadas antes dele veem a enquete.
	Corte  time.Time `json:"-"`
	Opcoes []Opcao   `json:"opcoes"`
}

// Conta é o que o serviço precisa saber de uma pessoa.
type Conta struct {
	CriadaEm time.Time
	// Respostas já dadas: enquete -> opção.
	Respostas map[string]string
}

// Resposta é o que o POST devolve.
type Resposta struct {
	Enquete string `json:"enquete"`
	Opcao   string `json:"opcao"`
	Badge   string `json:"badge,omitempty"`
}
```

`definicoes.go`:

```go
package enquete

import "time"

// SegundoTurno: quem já estava na Salinha no dia do segundo turno (25/10/2026)
// escolhe o badge de lembrança. Corte: contas criadas antes de 26/10/2026
// 00:00 em Brasília. Os badges l e v22 vivem em internal/badge (catalog.go).
var SegundoTurno = Enquete{
	ID:        "segundo-turno",
	Titulo:    "Escolha o seu badge do segundo turno",
	Descricao: "Você já estava na Salinha no dia, então pode escolher um badge de lembrança. A escolha é definitiva.",
	Corte:     time.Date(2026, 10, 26, 0, 0, 0, 0, time.FixedZone("BRT", -3*60*60)),
	Opcoes: []Opcao{
		{ID: "l", Rotulo: "Fez o L", Badge: "l"},
		{ID: "22", Rotulo: "Fez o 22", Badge: "v22"},
		{ID: "nenhum", Rotulo: "Prefiro não dizer"},
	},
}

// Todas são as enquetes que o app conhece, na ordem em que aparecem.
var Todas = []Enquete{SegundoTurno}
```

`service.go`:

```go
package enquete

import (
	"context"
	"fmt"
)

type store interface {
	Carregar(ctx context.Context, userID string) (Conta, error)
	// Gravar guarda a resposta; false se a pessoa já tinha respondido.
	Gravar(ctx context.Context, userID, enquete, opcao string) (bool, error)
}

// BadgeRefresher reavalia os badges de alguém na hora (badge.Service).
type BadgeRefresher interface {
	Refresh(ctx context.Context, userID string)
}

type Service struct {
	store    store
	badges   BadgeRefresher
	enquetes []Enquete
}

func EnqueteService(repository *Repository, badges BadgeRefresher, enquetes []Enquete) *Service {
	return &Service{store: repository, badges: badges, enquetes: enquetes}
}

func elegivel(e Enquete, c Conta) bool { return c.CriadaEm.Before(e.Corte) }

// Pendentes são as enquetes que userID pode responder e ainda não respondeu.
// Nunca devolve nil (o JSON precisa ser []).
func (s *Service) Pendentes(ctx context.Context, userID string) ([]Enquete, error) {
	c, err := s.store.Carregar(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := []Enquete{}
	for _, e := range s.enquetes {
		if _, respondeu := c.Respostas[e.ID]; elegivel(e, c) && !respondeu {
			out = append(out, e)
		}
	}
	return out, nil
}

func (s *Service) achar(id string) (Enquete, bool) {
	for _, e := range s.enquetes {
		if e.ID == id {
			return e, true
		}
	}
	return Enquete{}, false
}

func achaOpcao(e Enquete, id string) (Opcao, bool) {
	for _, o := range e.Opcoes {
		if o.ID == id {
			return o, true
		}
	}
	return Opcao{}, false
}

// Responder grava a resposta única de userID. Opção com badge reavalia os
// badges na hora (o desbloqueio e o aviso saem do badge.Service); as outras só
// impedem a pergunta de voltar.
func (s *Service) Responder(ctx context.Context, userID, enqueteID, opcaoID string) (Resposta, error) {
	e, ok := s.achar(enqueteID)
	if !ok {
		return Resposta{}, ErrEnqueteInexistente
	}
	op, ok := achaOpcao(e, opcaoID)
	if !ok {
		return Resposta{}, ErrOpcaoInvalida
	}
	c, err := s.store.Carregar(ctx, userID)
	if err != nil {
		return Resposta{}, err
	}
	if !elegivel(e, c) {
		return Resposta{}, ErrNaoElegivel
	}
	if _, ja := c.Respostas[e.ID]; ja {
		return Resposta{}, ErrJaRespondeu
	}
	gravou, err := s.store.Gravar(ctx, userID, e.ID, op.ID)
	if err != nil {
		return Resposta{}, fmt.Errorf("gravar resposta: %w", err)
	}
	if !gravou {
		return Resposta{}, ErrJaRespondeu
	}
	if op.Badge != "" {
		// A resposta já está gravada: se quem pediu desconectar agora, o
		// badge ainda precisa ser concedido e anunciado.
		s.badges.Refresh(context.WithoutCancel(ctx), userID)
	}
	return Resposta{Enquete: e.ID, Opcao: op.ID, Badge: op.Badge}, nil
}
```

(O `repository.go`, `handler.go` e os testes de handler ainda usam os nomes antigos: a Task 5 os troca. Para o pacote compilar entre as tarefas, esta tarefa e a Task 5 vão **no mesmo commit**.)

- [ ] **Step 4: executar o ciclo junto com a Task 5** (ver Task 5, Step 5).

---

### Task 5: repositório, handler, rotas e ligação

**Files:**
- Rewrite: `backend/internal/enquete/repository.go`, `handler.go`, `routes.go`, `handler_test.go`
- Modify: `backend/cmd/wire_engagement.go`

**Interfaces:**
- Consumes: `Service.Pendentes`, `Service.Responder`, `EnqueteService`, `Todas` (Task 4).
- Produces: `EnqueteRepository(db) *Repository`, `EnqueteHandler(*Service) *Handler`, `EnqueteRoutes(router, handler, auth)`, interface `enqueteSource`.

- [ ] **Step 1: testes do handler (falham)** — substitua `handler_test.go` por:

```go
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
```

- [ ] **Step 2: implementar**

`repository.go`:

```go
package enquete

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func EnqueteRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// Carregar junta a data da conta e as respostas já dadas.
func (r *Repository) Carregar(ctx context.Context, userID string) (Conta, error) {
	c := Conta{Respostas: map[string]string{}}
	err := r.db.QueryRow(ctx, `SELECT created_at FROM users WHERE id = $1`, userID).Scan(&c.CriadaEm)
	if errors.Is(err, pgx.ErrNoRows) {
		return Conta{}, ErrUsuarioNaoEncontrado
	}
	if err != nil {
		return Conta{}, err
	}
	rows, err := r.db.Query(ctx, `SELECT enquete, opcao FROM escolhas WHERE user_id = $1`, userID)
	if err != nil {
		return Conta{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var enquete, opcao string
		if err := rows.Scan(&enquete, &opcao); err != nil {
			return Conta{}, err
		}
		c.Respostas[enquete] = opcao
	}
	return c, rows.Err()
}

// Gravar insere a resposta; ON CONFLICT garante que a primeira vence mesmo
// com dois pedidos ao mesmo tempo.
func (r *Repository) Gravar(ctx context.Context, userID, enquete, opcao string) (bool, error) {
	tag, err := r.db.Exec(
		ctx,
		`INSERT INTO escolhas (user_id, enquete, opcao) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		userID, enquete, opcao,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}
```

`handler.go`:

```go
package enquete

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type enqueteSource interface {
	Pendentes(ctx context.Context, userID string) ([]Enquete, error)
	Responder(ctx context.Context, userID, enqueteID, opcaoID string) (Resposta, error)
}

type Handler struct {
	service enqueteSource
}

func EnqueteHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type respostaRequest struct {
	Opcao string `json:"opcao"`
}

// falha traduz o erro de domínio em status HTTP.
func falha(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrOpcaoInvalida):
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid option"})
	case errors.Is(err, ErrNaoElegivel):
		c.JSON(http.StatusForbidden, gin.H{"error": "not eligible"})
	case errors.Is(err, ErrJaRespondeu):
		c.JSON(http.StatusConflict, gin.H{"error": "already answered"})
	case errors.Is(err, ErrEnqueteInexistente):
		c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
	case errors.Is(err, ErrUsuarioNaoEncontrado):
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
	default:
		log.Printf("[enquete] %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process"})
	}
}

func idDeQuemChama(c *gin.Context) (string, bool) {
	v, ok := c.Get("userID")
	id, _ := v.(string)
	if !ok || id == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", false
	}
	return id, true
}

// Get: GET /users/me/enquetes, as enquetes que a pessoa pode e ainda não respondeu.
func (h *Handler) Get(c *gin.Context) {
	id, ok := idDeQuemChama(c)
	if !ok {
		return
	}
	pendentes, err := h.service.Pendentes(c.Request.Context(), id)
	if err != nil {
		falha(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"enquetes": pendentes})
}

// Post: POST /users/me/enquetes/:id {"opcao": "l"}. Resposta única.
func (h *Handler) Post(c *gin.Context) {
	id, ok := idDeQuemChama(c)
	if !ok {
		return
	}
	var req respostaRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Opcao == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "opcao is required"})
		return
	}
	res, err := h.service.Responder(c.Request.Context(), id, c.Param("id"), req.Opcao)
	if err != nil {
		falha(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}
```

`routes.go`:

```go
package enquete

import "github.com/gin-gonic/gin"

func EnqueteRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	router.GET("/users/me/enquetes", authMiddleware, handler.Get)
	router.POST("/users/me/enquetes/:id", authMiddleware, handler.Post)
}
```

`wire_engagement.go`: troque o bloco do banner por

```go
	// Enquetes de escolha única (hoje: badge do segundo turno). Opção com badge
	// reavalia os badges na hora; só contas anteriores ao corte da enquete a veem.
	enqueteHandler := enquete.EnqueteHandler(enquete.EnqueteService(
		enquete.EnqueteRepository(a.db), badgeService, enquete.Todas,
	))
```

e `enquete.SegundoTurnoRoutes(api, segundoTurnoHandler, a.authMiddleware)` por `enquete.EnqueteRoutes(api, enqueteHandler, a.authMiddleware)`.

- [ ] **Step 3: ver passar**

Run: `cd backend && "$GO" fmt ./internal/enquete ./cmd >/dev/null; "$GO" vet ./internal/enquete ./cmd ./internal/badge && "$GO" test ./internal/enquete ./internal/badge ./cmd`
Expected: PASS.

- [ ] **Step 4: CRAP e estrutura**

Run: `node scripts/crap.mjs && node scripts/check-structure.mjs`
Expected: `✅ Nenhuma função tocada acima do limite.` e estrutura ok.

- [ ] **Step 5: commit (Tasks 4 e 5 juntas)**

```bash
git add backend/internal/enquete backend/cmd/wire_engagement.go
git commit -m "feat(enquete): enquete de escolha única definida em código

GET /users/me/enquetes e POST /users/me/enquetes/:id. A opção pode
conceder um badge (l ou v22); nenhum só grava a resposta."
```

---

### Task 6: frontend: api, lib e store

**Files:**
- Create: `features/enquete/api/enquete.ts`, `features/enquete/lib/enquete.ts`, `features/enquete/lib/enquete.test.ts`, `features/enquete/store/enqueteStore.ts`, `features/enquete/store/enqueteStore.test.ts`
- Delete: `api/segundoTurno.ts`, `lib/segundoTurno{,.test}.ts`, `store/segundoTurnoStore{,.test}.ts` (e a dispensa)

**Interfaces:**
- Produces (`api/enquete.ts`):
  `EnqueteOpcao {id; rotulo; badge?}`, `Enquete {id; titulo; descricao; opcoes}`, `RespostaEnquete {enquete; opcao; badge?}`, `fetchPendentes(): Promise<Enquete[]>`, `responderEnquete(id, opcao): Promise<RespostaEnquete>`.
- Produces (`lib/enquete.ts`): `Etapa`, `Reacao`, `Fase`, `EntradaFase`, `faseAtual`, `reacaoDe`, `achaOpcao`, `CELEBRACAO_MS = 6_000`, `NEUTRA_MS = 4_500`.
- Produces (`store/enqueteStore.ts`): `useEnqueteStore` com `userId, pendentes, selecao, etapa, reacao, enviando, erro` e `carregar, selecionar, continuar, voltar, confirmar, fecharReacao, reset`.

(Caminhos relativos a `frontend/src/renderer/src/`.)

- [ ] **Step 1: testes da lib (falham)** — `features/enquete/lib/enquete.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Enquete } from '../api/enquete'
import { achaOpcao, faseAtual, reacaoDe } from './enquete'

const enquete: Enquete = {
  id: 'segundo-turno',
  titulo: 'T',
  descricao: 'D',
  opcoes: [
    { id: 'l', rotulo: 'Fez o L', badge: 'l' },
    { id: '22', rotulo: 'Fez o 22', badge: 'v22' },
    { id: 'nenhum', rotulo: 'Prefiro não dizer' }
  ]
}

describe('faseAtual', () => {
  it('sem pendentes e sem reação, nada na tela', () => {
    expect(faseAtual({ pendentes: [], etapa: 'pergunta', reacao: null })).toBe('oculto')
  })

  it('com pendente mostra a etapa atual', () => {
    expect(faseAtual({ pendentes: [enquete], etapa: 'pergunta', reacao: null })).toBe('pergunta')
    expect(faseAtual({ pendentes: [enquete], etapa: 'confirmacao', reacao: null })).toBe('confirmacao')
  })

  it('a reação vem antes de tudo, mesmo com outra enquete pendente', () => {
    const celebracao = { tipo: 'celebracao', badge: 'l', rotulo: 'Fez o L' } as const
    expect(faseAtual({ pendentes: [enquete], etapa: 'pergunta', reacao: celebracao })).toBe('celebracao')
    expect(faseAtual({ pendentes: [], etapa: 'pergunta', reacao: { tipo: 'neutra' } })).toBe('neutra')
  })
})

describe('reacaoDe', () => {
  it('opção com badge celebra com o badge e o rótulo', () => {
    expect(reacaoDe(enquete.opcoes[1])).toEqual({ tipo: 'celebracao', badge: 'v22', rotulo: 'Fez o 22' })
  })

  it('opção sem badge dá o aviso neutro', () => {
    expect(reacaoDe(enquete.opcoes[2])).toEqual({ tipo: 'neutra' })
  })
})

describe('achaOpcao', () => {
  it('acha pelo id e devolve undefined se não existir', () => {
    expect(achaOpcao(enquete, '22')?.rotulo).toBe('Fez o 22')
    expect(achaOpcao(enquete, 'zzz')).toBeUndefined()
    expect(achaOpcao(undefined, 'l')).toBeUndefined()
  })
})
```

- [ ] **Step 2: implementar api e lib**

`features/enquete/api/enquete.ts`:

```ts
import { request } from '../../../shared/api/client'

/** Backend: internal/enquete. */
export interface EnqueteOpcao {
  id: string
  rotulo: string
  /** Categoria do badge que a opção concede (internal/badge); sem badge, nenhuma. */
  badge?: string
}

export interface Enquete {
  id: string
  titulo: string
  descricao: string
  opcoes: EnqueteOpcao[]
}

export interface RespostaEnquete {
  enquete: string
  opcao: string
  badge?: string
}

/** As enquetes que a pessoa pode responder e ainda não respondeu. */
export async function fetchPendentes(): Promise<Enquete[]> {
  const res = await request<{ enquetes: Enquete[] }>('/users/me/enquetes')
  return res.enquetes
}

/** Resposta única: o servidor recusa (409) uma segunda. */
export function responderEnquete(id: string, opcao: string): Promise<RespostaEnquete> {
  return request<RespostaEnquete>(`/users/me/enquetes/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ opcao })
  })
}
```

`features/enquete/lib/enquete.ts`:

```ts
import type { Enquete, EnqueteOpcao } from '../api/enquete'

/** Pergunta (escolher a opção) e confirmação ("não dá para mudar depois"). */
export type Etapa = 'pergunta' | 'confirmacao'

/** O que mostrar depois de responder: celebração do badge ou aviso neutro. */
export type Reacao = { tipo: 'celebracao'; badge: string; rotulo: string } | { tipo: 'neutra' }

export type Fase = 'oculto' | Etapa | Reacao['tipo']

export interface EntradaFase {
  pendentes: Enquete[]
  etapa: Etapa
  reacao: Reacao | null
}

/** Quanto cada reação fica na tela se ninguém fechar. */
export const CELEBRACAO_MS = 6_000
export const NEUTRA_MS = 4_500

/** A reação ao responder vem primeiro; depois, a próxima pendente, se houver. */
export function faseAtual({ pendentes, etapa, reacao }: EntradaFase): Fase {
  if (reacao) return reacao.tipo
  return pendentes.length > 0 ? etapa : 'oculto'
}

export function reacaoDe(opcao: EnqueteOpcao): Reacao {
  return opcao.badge
    ? { tipo: 'celebracao', badge: opcao.badge, rotulo: opcao.rotulo }
    : { tipo: 'neutra' }
}

export function achaOpcao(enquete: Enquete | undefined, id: string): EnqueteOpcao | undefined {
  return enquete?.opcoes.find((o) => o.id === id)
}
```

- [ ] **Step 3: testes do store (falham)** — `features/enquete/store/enqueteStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBadges = vi.hoisted(() => vi.fn())
vi.mock('../../levels/store/badgeStore', () => ({
  useBadgeStore: { getState: () => ({ ensureBadges }) }
}))
vi.mock('../api/enquete', () => ({
  fetchPendentes: vi.fn(),
  responderEnquete: vi.fn()
}))

import { ApiError } from '../../../shared/api/client'
import { fetchPendentes, responderEnquete, type Enquete } from '../api/enquete'
import { useEnqueteStore } from './enqueteStore'

const fetchMock = vi.mocked(fetchPendentes)
const responderMock = vi.mocked(responderEnquete)

const enquete: Enquete = {
  id: 'segundo-turno',
  titulo: 'T',
  descricao: 'D',
  opcoes: [
    { id: 'l', rotulo: 'Fez o L', badge: 'l' },
    { id: '22', rotulo: 'Fez o 22', badge: 'v22' },
    { id: 'nenhum', rotulo: 'Prefiro não dizer' }
  ]
}
const outra: Enquete = { ...enquete, id: 'outra' }

const estado = (): ReturnType<typeof useEnqueteStore.getState> => useEnqueteStore.getState()

async function ate(etapa: 'confirmacao', opcao: string): Promise<void> {
  await estado().carregar('ana')
  estado().selecionar(opcao)
  estado().continuar()
  expect(estado().etapa).toBe(etapa)
}

describe('enqueteStore', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    responderMock.mockReset()
    ensureBadges.mockReset()
    fetchMock.mockResolvedValue([enquete])
    estado().reset()
  })

  it('carrega as pendentes uma vez por pessoa', async () => {
    await estado().carregar('ana')
    await estado().carregar('ana')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(estado().pendentes).toEqual([enquete])
  })

  it('troca de pessoa descarta o estado da anterior', async () => {
    await estado().carregar('ana')
    estado().selecionar('l')
    fetchMock.mockResolvedValue([])
    await estado().carregar('bia')
    expect(estado().pendentes).toEqual([])
    expect(estado().selecao).toBeNull()
  })

  it('sem pendentes (já respondeu ou fora do corte) nada aparece', async () => {
    fetchMock.mockResolvedValue([])
    await estado().carregar('ana')
    expect(estado().pendentes).toEqual([])
  })

  it('erro ao carregar deixa sem modal e carregar de novo tenta outra vez (foco da janela)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValueOnce(new Error('sem rede'))
    await estado().carregar('ana')
    expect(estado().pendentes).toEqual([])
    await estado().carregar('ana')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(estado().pendentes).toEqual([enquete])
  })

  it('continuar sem opção marcada não sai da pergunta; voltar mantém a escolha', async () => {
    await estado().carregar('ana')
    estado().continuar()
    expect(estado().etapa).toBe('pergunta')
    estado().selecionar('l')
    estado().continuar()
    expect(estado().etapa).toBe('confirmacao')
    estado().voltar()
    expect(estado().etapa).toBe('pergunta')
    expect(estado().selecao).toBe('l')
  })

  it('selecionar ignora opção que a enquete não tem', async () => {
    await estado().carregar('ana')
    estado().selecionar('zzz')
    expect(estado().selecao).toBeNull()
  })

  it('confirmar opção com badge: celebra, tira a enquete e recarrega os badges', async () => {
    await ate('confirmacao', '22')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: '22', badge: 'v22' })
    await estado().confirmar()
    expect(responderMock).toHaveBeenCalledWith('segundo-turno', '22')
    expect(estado().reacao).toEqual({ tipo: 'celebracao', badge: 'v22', rotulo: 'Fez o 22' })
    expect(estado().pendentes).toEqual([])
    expect(estado().etapa).toBe('pergunta')
    expect(estado().selecao).toBeNull()
    expect(estado().enviando).toBe(false)
    expect(ensureBadges).toHaveBeenCalledWith('ana', true)
  })

  it('confirmar "nenhum": aviso neutro e os badges ficam como estão', async () => {
    await ate('confirmacao', 'nenhum')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: 'nenhum' })
    await estado().confirmar()
    expect(estado().reacao).toEqual({ tipo: 'neutra' })
    expect(ensureBadges).not.toHaveBeenCalled()
  })

  it('fecharReacao limpa a reação e mostra a próxima pendente', async () => {
    fetchMock.mockResolvedValue([enquete, outra])
    await ate('confirmacao', 'l')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: 'l', badge: 'l' })
    await estado().confirmar()
    expect(estado().pendentes).toEqual([outra])
    estado().fecharReacao()
    expect(estado().reacao).toBeNull()
    expect(estado().pendentes[0].id).toBe('outra')
  })

  it('falha ao enviar mantém a confirmação aberta, marca o erro e libera os botões', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await ate('confirmacao', 'l')
    responderMock.mockRejectedValue(new Error('sem rede'))
    await estado().confirmar()
    expect(estado().etapa).toBe('confirmacao')
    expect(estado().erro).toBe(true)
    expect(estado().enviando).toBe(false)
    expect(estado().reacao).toBeNull()
  })

  it('409 (respondeu em outro aparelho) recarrega as pendentes em vez de mostrar erro', async () => {
    await ate('confirmacao', 'l')
    responderMock.mockRejectedValue(new ApiError(409, 'already answered'))
    fetchMock.mockResolvedValue([])
    await estado().confirmar()
    expect(estado().erro).toBe(false)
    expect(estado().pendentes).toEqual([])
    expect(estado().reacao).toBeNull()
  })

  it('dois cliques seguidos em confirmar enviam uma vez só', async () => {
    await ate('confirmacao', 'l')
    let liberar: (v: { enquete: string; opcao: string; badge: string }) => void = () => {}
    responderMock.mockReturnValue(new Promise((r) => (liberar = r)))
    const a = estado().confirmar()
    const b = estado().confirmar()
    liberar({ enquete: 'segundo-turno', opcao: 'l', badge: 'l' })
    await Promise.all([a, b])
    expect(responderMock).toHaveBeenCalledTimes(1)
  })

  it('resposta que chega depois de trocar de pessoa é descartada', async () => {
    await ate('confirmacao', 'l')
    let liberar: (v: { enquete: string; opcao: string; badge: string }) => void = () => {}
    responderMock.mockReturnValue(new Promise((r) => (liberar = r)))
    const pendente = estado().confirmar()
    estado().reset()
    await estado().carregar('bia')
    liberar({ enquete: 'segundo-turno', opcao: 'l', badge: 'l' })
    await pendente
    expect(estado().reacao).toBeNull()
    expect(estado().pendentes).toEqual([enquete])
  })
})
```

- [ ] **Step 4: implementar o store** — `features/enquete/store/enqueteStore.ts`:

```ts
import { create } from 'zustand'
import { ApiError } from '../../../shared/api/client'
import { fetchPendentes, responderEnquete, type Enquete } from '../api/enquete'
import { useBadgeStore } from '../../levels/store/badgeStore'
import { achaOpcao, reacaoDe, type Etapa, type Reacao } from '../lib/enquete'

interface EnqueteState {
  /** De quem é o estado abaixo: trocar de conta descarta tudo. */
  userId: string | null
  /** Pendentes; a primeira é a que está na tela. */
  pendentes: Enquete[]
  /** Opção marcada na enquete atual. */
  selecao: string | null
  etapa: Etapa
  reacao: Reacao | null
  enviando: boolean
  /** O último envio falhou (rede, servidor): a confirmação continua aberta. */
  erro: boolean
  carregar: (userId: string) => Promise<void>
  selecionar: (opcaoId: string) => void
  continuar: () => void
  voltar: () => void
  confirmar: () => Promise<void>
  fecharReacao: () => void
  reset: () => void
}

const INICIAL = {
  userId: null,
  pendentes: [] as Enquete[],
  selecao: null,
  etapa: 'pergunta' as Etapa,
  reacao: null,
  enviando: false,
  erro: false
}

/** 403/409/404: o servidor já decidiu (respondeu em outro aparelho, fora do corte). */
function jaDecidido(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 403 || err.status === 404 || err.status === 409)
}

export const useEnqueteStore = create<EnqueteState>()((set, get) => ({
  ...INICIAL,

  carregar: async (userId) => {
    if (get().userId === userId && get().pendentes.length > 0) return
    set({ ...INICIAL, userId })
    try {
      const pendentes = await fetchPendentes()
      if (get().userId === userId) set({ pendentes })
    } catch (err) {
      console.error('[enqueteStore] fetch failed:', err)
    }
  },

  selecionar: (opcaoId) => {
    if (achaOpcao(get().pendentes[0], opcaoId)) set({ selecao: opcaoId, erro: false })
  },

  continuar: () => {
    if (get().selecao) set({ etapa: 'confirmacao', erro: false })
  },

  voltar: () => set({ etapa: 'pergunta', erro: false }),

  confirmar: async () => {
    const { userId, enviando, selecao, pendentes } = get()
    const enquete = pendentes[0]
    const opcao = achaOpcao(enquete, selecao ?? '')
    if (!userId || enviando || !enquete || !opcao) return
    set({ enviando: true, erro: false })
    try {
      await responderEnquete(enquete.id, opcao.id)
      if (get().userId !== userId) return
      set({
        pendentes: get().pendentes.slice(1),
        selecao: null,
        etapa: 'pergunta',
        reacao: reacaoDe(opcao),
        enviando: false
      })
      // O badge já existe no servidor; não depende do aviso pelo websocket.
      if (opcao.badge) void useBadgeStore.getState().ensureBadges(userId, true)
    } catch (err) {
      if (get().userId !== userId) return
      if (jaDecidido(err)) {
        set({ enviando: false, pendentes: [] })
        await get().carregar(userId)
        return
      }
      console.error('[enqueteStore] responder failed:', err)
      set({ enviando: false, erro: true })
    }
  },

  fecharReacao: () => set({ reacao: null }),

  reset: () => set({ ...INICIAL })
}))
```

- [ ] **Step 5: apagar o que saiu e rodar**

```bash
cd frontend/src/renderer/src/features/enquete
git rm -q api/segundoTurno.ts lib/segundoTurno.ts lib/segundoTurno.test.ts store/segundoTurnoStore.ts store/segundoTurnoStore.test.ts
```

Run (em `frontend/`): `npx vitest run src/renderer/src/features/enquete/lib src/renderer/src/features/enquete/store && npx prettier --check --end-of-line auto src/renderer/src/features/enquete`
Expected: PASS (as suítes de componentes ainda apontam para o código antigo e quebram até a Task 7: rode só `lib` e `store`).

- [ ] **Step 6: commit**

```bash
git add frontend/src/renderer/src/features/enquete
git commit -m "feat(enquete): estado e fluxo da enquete no frontend

Store próprio com pergunta, confirmação e reação; sem dispensa."
```

---

### Task 7: componentes, CSS, AppShell e limpeza

**Files:**
- Rewrite/rename em `features/enquete/components/`: `SegundoTurnoCamada.tsx` → `EnqueteCamada.tsx`, `SegundoTurnoCelebracao.tsx` → `EnqueteCelebracao.tsx`, `SegundoTurnoHost.tsx` → `EnqueteHost.tsx`; novos `EnquetePergunta.tsx`, `EnqueteConfirmacao.tsx`, `EnqueteNeutra.tsx`; teste `Enquete.test.tsx` (troca `SegundoTurno.test.tsx`)
- Delete: `SegundoTurnoBanner.tsx`, `SegundoTurnoTriste.tsx`, `SegundoTurnoIcone.tsx`, `hooks/useBotaoSegundoTurno.ts`
- Modify: `assets/enquete.css`, `app/AppShell.tsx`, `features/servers/components/ServerRail.tsx` (volta ao original), `features/levels/lib/badges.ts` + `badges.test.ts`

**Interfaces:**
- Consumes: `useEnqueteStore`, `faseAtual`, `CELEBRACAO_MS`, `NEUTRA_MS`, `useFecharEm` (já existe em `hooks/`).
- Produces: `EnqueteHost` (default export, sem props) montado no `AppShell`.

- [ ] **Step 1: teste de `unlocksComAviso` com `v22` (falha)** — em `features/levels/lib/badges.test.ts` acrescente:

```ts
describe('unlocksComAviso', () => {
  const unlock = (category: string): BadgeUnlockEvent['unlocks'][number] => ({
    category,
    name: category,
    tier: 1,
    tier_name: category,
    rarity: 'lendario'
  })

  it('l e v22 têm celebração própria e ficam fora do aviso genérico', () => {
    const lista = [unlock('l'), unlock('voz'), unlock('v22')]
    expect(unlocksComAviso(lista).map((u) => u.category)).toEqual(['voz'])
  })
})
```

(importe `unlocksComAviso` de `./badges` e `type BadgeUnlockEvent` de `../api/badges` no topo do arquivo.) Em `badges.ts`, troque `new Set(['l'])` por `new Set(['l', 'v22'])`. Run: `npx vitest run src/renderer/src/features/levels` → PASS.

- [ ] **Step 2: testes dos componentes (falham)** — apague `components/SegundoTurno.test.tsx` e crie `components/Enquete.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  acoes: {
    carregar: vi.fn(),
    reset: vi.fn(),
    selecionar: vi.fn(),
    continuar: vi.fn(),
    voltar: vi.fn(),
    confirmar: vi.fn(),
    fecharReacao: vi.fn()
  },
  userId: 'me' as string | undefined
}))
vi.mock('../store/enqueteStore', () => ({
  useEnqueteStore: (select: (s: unknown) => unknown) => select({ ...store.state, ...store.acoes })
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ user: store.userId ? { id: store.userId } : null })
}))
// Sem DOM: o portal vira o próprio conteúdo.
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => node
}))

import { renderToStaticMarkup } from 'react-dom/server'
import EnqueteHost from './EnqueteHost'

const enquete = {
  id: 'segundo-turno',
  titulo: 'Escolha o seu badge do segundo turno',
  descricao: 'Você já estava na Salinha no dia, então pode escolher um badge de lembrança. A escolha é definitiva.',
  opcoes: [
    { id: 'l', rotulo: 'Fez o L', badge: 'l' },
    { id: '22', rotulo: 'Fez o 22', badge: 'v22' },
    { id: 'nenhum', rotulo: 'Prefiro não dizer' }
  ]
}

function estado(over: Record<string, unknown> = {}): void {
  store.state = {
    pendentes: [enquete],
    selecao: null,
    etapa: 'pergunta',
    reacao: null,
    enviando: false,
    erro: false,
    ...over
  }
}

const render = (): string => renderToStaticMarkup(<EnqueteHost />)

describe('enquete (componentes)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { body: {} })
    store.userId = 'me'
    Object.values(store.acoes).forEach((fn) => fn.mockReset())
    estado()
  })

  describe('pergunta', () => {
    it('mostra título, descrição e as três opções como rádios de mesmo tamanho', () => {
      const html = render()
      expect(html).toContain('role="dialog"')
      expect(html).toContain('aria-modal="true"')
      expect(html).toContain('Escolha o seu badge do segundo turno')
      expect(html).toContain('A escolha é definitiva.')
      for (const rotulo of ['Fez o L', 'Fez o 22', 'Prefiro não dizer']) expect(html).toContain(rotulo)
      expect(html.match(/type="radio"/g)?.length).toBe(3)
    })

    it('é obrigatório: sem botão de fechar', () => {
      expect(render()).not.toContain('aria-label="Fechar"')
    })

    it('"Continuar" só habilita com uma opção marcada', () => {
      expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>Continuar/)
      estado({ selecao: 'l' })
      const html = render()
      expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Continuar/)
      expect(html).toMatch(/value="l"[^>]*checked=""/)
    })

    it('em 360 px as opções empilham, o cartão não passa da tela e os alvos têm 44 px', () => {
      const html = render()
      expect(html).toContain('w-full')
      expect(html).toContain('max-w-sm')
      expect(html).toContain('min-h-11')
      expect(html).toContain('overflow-y-auto')
    })
  })

  describe('confirmação', () => {
    it('repete a opção e avisa que é definitivo, com Confirmar e Voltar', () => {
      estado({ etapa: 'confirmacao', selecao: '22' })
      const html = render()
      expect(html).toContain('Confirmar: Fez o 22?')
      expect(html).toContain('Não dá para mudar depois.')
      expect(html).toMatch(/>Confirmar</)
      expect(html).toMatch(/>Voltar</)
      expect(html).not.toContain('aria-label="Fechar"')
    })

    it('enquanto envia, desabilita Confirmar e Voltar', () => {
      estado({ etapa: 'confirmacao', selecao: 'l', enviando: true })
      expect(render().match(/disabled=""/g)?.length).toBe(2)
    })

    it('mostra o erro de envio (e só nesse caso)', () => {
      estado({ etapa: 'confirmacao', selecao: 'l' })
      expect(render()).not.toContain('role="alert"')
      estado({ etapa: 'confirmacao', selecao: 'l', erro: true })
      const html = render()
      expect(html).toContain('role="alert"')
      expect(html).toContain('Não foi possível enviar. Tente de novo.')
    })
  })

  describe('reações', () => {
    it('celebração: badge grande, nome do badge e pode fechar', () => {
      estado({ pendentes: [], reacao: { tipo: 'celebracao', badge: 'v22', rotulo: 'Fez o 22' } })
      const html = render()
      expect(html).toContain('Badge conquistado!')
      expect(html).toContain('Fez o 22')
      expect(html).toContain('enquete-badge')
      expect(html).toContain('width:224px')
      expect(html).toContain('aria-label="Fechar"')
    })

    it('aviso neutro: sem animação de celebração e com Fechar', () => {
      estado({ pendentes: [], reacao: { tipo: 'neutra' } })
      const html = render()
      expect(html).toContain('Tudo certo! Sua escolha foi guardada.')
      expect(html).not.toContain('enquete-badge')
      expect(html).toMatch(/>Fechar</)
    })
  })

  describe('host', () => {
    it('sem pendentes e sem reação: nada na tela', () => {
      estado({ pendentes: [] })
      expect(render()).toBe('')
    })
  })
})
```

- [ ] **Step 3: implementar os componentes** — apague os antigos e crie:

```bash
cd frontend/src/renderer/src/features/enquete
git rm -q components/SegundoTurnoBanner.tsx components/SegundoTurnoTriste.tsx components/SegundoTurnoIcone.tsx components/SegundoTurno.test.tsx hooks/useBotaoSegundoTurno.ts
git mv components/SegundoTurnoCamada.tsx components/EnqueteCamada.tsx
git mv components/SegundoTurnoCelebracao.tsx components/EnqueteCelebracao.tsx
git mv components/SegundoTurnoHost.tsx components/EnqueteHost.tsx
```

`components/EnqueteCamada.tsx` (opcional `onFechar`; sem ele o diálogo é obrigatório):

```tsx
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { focusableIn, trapTab } from '../../../shared/lib/focusTrap'
import { XIcon } from '../../../shared/ui/icons'
import '../../../assets/enquete.css'

interface Props {
  /** id do título dentro de `children` (aria-labelledby). */
  titleId: string
  /** Sem `onFechar` o diálogo é obrigatório: sem X, sem Esc e sem fechar por fora. */
  onFechar?: () => void
  children: React.ReactNode
}

/**
 * O diálogo da enquete: fundo escuro, Tab preso dentro e foco devolvido ao
 * fechar. Com `onFechar`, X, Esc e clicar fora fecham; sem ele, só o conteúdo
 * (ex.: confirmar a escolha) tira a pessoa daqui. O cartão ocupa a largura da
 * tela até 24 rem, de 360 px para cima.
 */
function EnqueteCamada({ titleId, onFechar, children }: Props): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Foco no primeiro item (o X, quando existe) e, ao sair, de volta para onde estava.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    if (dialogRef.current) focusableIn(dialogRef.current)[0]?.focus()
    return () => {
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  // Captura na janela: Esc não chega nos outros atalhos (e só fecha se puder).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onFechar?.()
        return
      }
      trapTab(e, dialogRef.current)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onFechar])

  return createPortal(
    <div
      className="app-no-drag fixed inset-x-0 bottom-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4 backdrop-blur-sm"
      style={{ top: 'var(--titlebar-height, 0px)' }}
      onClick={onFechar}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="enquete-card relative my-auto w-full max-w-sm rounded-2xl border border-subtle bg-primary p-6 text-center text-gray-200 shadow-2xl"
      >
        {onFechar && (
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="absolute right-1 top-1 flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            <XIcon className="h-5 w-5" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

export default EnqueteCamada
```

`components/EnquetePergunta.tsx`:

```tsx
import { useId } from 'react'
import type { Enquete } from '../api/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCamada from './EnqueteCamada'

const BOTAO =
  'flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-60'

/** A pergunta: opções iguais (rádios) e "Continuar" só com uma marcada. */
function EnquetePergunta({ enquete }: { enquete: Enquete }): React.JSX.Element {
  const selecao = useEnqueteStore((s) => s.selecao)
  const selecionar = useEnqueteStore((s) => s.selecionar)
  const continuar = useEnqueteStore((s) => s.continuar)
  const titleId = useId()

  return (
    <EnqueteCamada titleId={titleId}>
      <h2 id={titleId} className="text-balance text-lg font-bold text-strong">
        {enquete.titulo}
      </h2>
      <p className="mt-2 text-sm text-gray-400">{enquete.descricao}</p>
      <fieldset className="mt-5 flex flex-col gap-2 text-left">
        <legend className="sr-only">{enquete.titulo}</legend>
        {enquete.opcoes.map((o) => (
          <label
            key={o.id}
            className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-subtle bg-surface px-4 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10 has-[:checked]:border-violet-400 has-[:checked]:bg-violet-600/20 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet-400"
          >
            <input
              type="radio"
              name={enquete.id}
              value={o.id}
              checked={selecao === o.id}
              onChange={() => selecionar(o.id)}
              className="h-4 w-4 accent-violet-500"
            />
            {o.rotulo}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        disabled={!selecao}
        onClick={continuar}
        className={`${BOTAO} mt-5 bg-violet-600 text-white hover:bg-violet-500`}
      >
        Continuar
      </button>
    </EnqueteCamada>
  )
}

export default EnquetePergunta
```

`components/EnqueteConfirmacao.tsx`:

```tsx
import { useId } from 'react'
import type { Enquete } from '../api/enquete'
import { achaOpcao } from '../lib/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCamada from './EnqueteCamada'

const BOTAO =
  'flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1'

/** "Confirmar: Fez o L?": a escolha é definitiva, então pede um segundo toque. */
function EnqueteConfirmacao({ enquete }: { enquete: Enquete }): React.JSX.Element {
  const selecao = useEnqueteStore((s) => s.selecao)
  const enviando = useEnqueteStore((s) => s.enviando)
  const erro = useEnqueteStore((s) => s.erro)
  const confirmar = useEnqueteStore((s) => s.confirmar)
  const voltar = useEnqueteStore((s) => s.voltar)
  const titleId = useId()
  const rotulo = achaOpcao(enquete, selecao ?? '')?.rotulo ?? ''

  return (
    <EnqueteCamada titleId={titleId}>
      <h2 id={titleId} className="text-balance text-lg font-bold text-strong">
        Confirmar: {rotulo}?
      </h2>
      <p className="mt-2 text-sm text-gray-400">Não dá para mudar depois.</p>
      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          Não foi possível enviar. Tente de novo.
        </p>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={enviando}
          onClick={() => void confirmar()}
          className={`${BOTAO} bg-violet-600 text-white hover:bg-violet-500`}
        >
          Confirmar
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={voltar}
          className={`${BOTAO} border border-subtle bg-surface text-gray-200 hover:bg-white/10`}
        >
          Voltar
        </button>
      </div>
    </EnqueteCamada>
  )
}

export default EnqueteConfirmacao
```

`components/EnqueteCelebracao.tsx` (recebe o badge e o rótulo da reação):

```tsx
import { useId } from 'react'
import BadgeIcon from '../../levels/components/BadgeIcon'
import { rarityMeta } from '../../levels/lib/badges'
import { useFecharEm } from '../hooks/useFecharEm'
import { CELEBRACAO_MS } from '../lib/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCamada from './EnqueteCamada'

// Os badges de enquete são todos Lendários (internal/badge/catalog.go).
const RARIDADE = 'lendario'

/**
 * O badge ganho em tamanho grande, com raios e brilho (parados com
 * prefers-reduced-motion). Fecha sozinho, ao tocar fora ou com Esc.
 */
function EnqueteCelebracao({ badge, rotulo }: { badge: string; rotulo: string }): React.JSX.Element {
  const fechar = useEnqueteStore((s) => s.fecharReacao)
  const titleId = useId()
  const cor = rarityMeta(RARIDADE).color
  useFecharEm(CELEBRACAO_MS, fechar)

  return (
    <EnqueteCamada titleId={titleId} onFechar={fechar}>
      <div className="relative mx-auto flex h-56 w-56 max-w-full items-center justify-center">
        <div aria-hidden="true" className="enquete-raios absolute inset-[-40%]" />
        <div
          aria-hidden="true"
          className="enquete-brilho absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, ${cor}66 0%, transparent 70%)` }}
        />
        <BadgeIcon
          category={badge}
          tier={1}
          rarity={RARIDADE}
          size={224}
          className="enquete-badge relative max-w-full"
        />
      </div>
      <h2 id={titleId} className="mt-4 text-balance text-xl font-bold text-strong">
        Badge conquistado!
      </h2>
      <p className="mt-1 text-sm font-bold" style={{ color: cor }}>
        {rotulo}
      </p>
    </EnqueteCamada>
  )
}

export default EnqueteCelebracao
```

`components/EnqueteNeutra.tsx`:

```tsx
import { useId } from 'react'
import { useFecharEm } from '../hooks/useFecharEm'
import { NEUTRA_MS } from '../lib/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCamada from './EnqueteCamada'

/** Para quem preferiu não dizer: só confirma que a escolha foi guardada. */
function EnqueteNeutra(): React.JSX.Element {
  const fechar = useEnqueteStore((s) => s.fecharReacao)
  const titleId = useId()
  useFecharEm(NEUTRA_MS, fechar)

  return (
    <EnqueteCamada titleId={titleId} onFechar={fechar}>
      <h2 id={titleId} className="text-balance text-base font-bold text-strong">
        Tudo certo! Sua escolha foi guardada.
      </h2>
      <button
        type="button"
        onClick={fechar}
        className="mt-5 flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center rounded-xl border border-subtle bg-surface px-4 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        Fechar
      </button>
    </EnqueteCamada>
  )
}

export default EnqueteNeutra
```

`components/EnqueteHost.tsx`:

```tsx
import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { faseAtual } from '../lib/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCelebracao from './EnqueteCelebracao'
import EnqueteConfirmacao from './EnqueteConfirmacao'
import EnqueteNeutra from './EnqueteNeutra'
import EnquetePergunta from './EnquetePergunta'

/**
 * Carrega as enquetes pendentes de quem está logado e mostra a primeira
 * (pergunta, confirmação ou a reação à resposta). Depois de responder, a
 * próxima pendente aparece sozinha.
 */
function EnqueteHost(): React.JSX.Element | null {
  const userId = useAuthStore((s) => s.user?.id)
  const carregar = useEnqueteStore((s) => s.carregar)
  const reset = useEnqueteStore((s) => s.reset)
  const fase = useEnqueteStore(faseAtual)
  const enquete = useEnqueteStore((s) => s.pendentes[0])
  const reacao = useEnqueteStore((s) => s.reacao)

  useEffect(() => {
    if (userId) void carregar(userId)
    else reset()
  }, [userId, carregar, reset])

  // Falha de rede ao abrir o app: tenta de novo quando a janela volta ao foco
  // (sem custo se as pendentes já foram carregadas).
  useEffect(() => {
    if (!userId) return
    const retry = (): void => void carregar(userId)
    window.addEventListener('focus', retry)
    return () => window.removeEventListener('focus', retry)
  }, [userId, carregar])

  if (reacao?.tipo === 'celebracao') return <EnqueteCelebracao badge={reacao.badge} rotulo={reacao.rotulo} />
  if (fase === 'neutra') return <EnqueteNeutra />
  if (!enquete) return null
  if (fase === 'pergunta') return <EnquetePergunta enquete={enquete} />
  if (fase === 'confirmacao') return <EnqueteConfirmacao enquete={enquete} />
  return null
}

export default EnqueteHost
```

- [ ] **Step 4: CSS** — em `assets/enquete.css` renomeie as classes `segundo-turno-*` para `enquete-*` (`card`, `badge`, `raios`, `brilho`, `entrada`, `pop`) e apague `.segundo-turno-letra`, `.segundo-turno-triste` e o keyframe `segundo-turno-murcha`. Atualize o comentário do topo para `/* Enquete de escolha única (features/enquete). */` e o bloco `prefers-reduced-motion` para listar só `.enquete-card, .enquete-badge, .enquete-raios, .enquete-brilho`.

- [ ] **Step 5: ligar e desligar**

```bash
cd frontend/src/renderer/src
git checkout 4735e1d -- features/servers/components/ServerRail.tsx   # volta ao original (sem botão "L")
sed -i "s#features/enquete/components/SegundoTurnoHost#features/enquete/components/EnqueteHost#; s#SegundoTurnoHost#EnqueteHost#g" app/AppShell.tsx
```

Confira que `app/AppShell.tsx` só difere do original por `import EnqueteHost ...` e `<EnqueteHost />`.

- [ ] **Step 6: testes, tipos, prettier, eslint**

Run (em `frontend/`):
`npx vitest run src/renderer/src/features/enquete src/renderer/src/features/levels src/renderer/src/features/servers && npm run typecheck && npx prettier --check --end-of-line auto src/renderer/src/features/enquete src/renderer/src/assets/enquete.css src/renderer/src/app/AppShell.tsx && npx eslint src/renderer/src/features/enquete src/renderer/src/app/AppShell.tsx 2>&1 | tail -3`
Expected: testes e tipos PASS, prettier ok, `0 errors`.

- [ ] **Step 7: commit**

```bash
git add frontend/src/renderer/src
git commit -m "feat(enquete): modal obrigatório de escolha com confirmação e reações

Pergunta com rádios, confirmação em dois passos, celebração do badge e
aviso neutro. O botão L da barra e a dispensa saem."
```

---

### Task 8: changelog, spec/plan antigos, verificação e CRAP

**Files:**
- Modify: `changelog/next.md`, `docs/superpowers/plans/2026-10-27-badge-l.md` (nota de que foi substituído)

- [ ] **Step 1: changelog** — em `changelog/next.md` substitua a linha "Badges: novo badge "Fez o L" ..." por:

`- Badges: quem já estava na Salinha até 25/10/2026 escolhe um badge do segundo turno (Fez o L, Fez o 22 ou nenhum). A escolha é definitiva e só aparece uma vez.`

- [ ] **Step 2: nota no plano anterior** — no topo de `2026-10-27-badge-l.md`, logo abaixo do título, acrescente: `> **Substituído** pela enquete (`2026-10-27-enquete-segundo-turno.md`): o banner sim/não, o botão do rail e a dispensa saíram.`

- [ ] **Step 3: gate completo**

Run: `export GO=...; node scripts/affected-tests.mjs pr > /tmp/pr.txt 2>&1; echo exit=$?; tail -5 /tmp/pr.txt`
Expected: `exit=0` e `✅ Tudo verde.` (o diff toca `AppShell.tsx`, então roda a suíte inteira). Guarde a saída do CRAP depois para o PR.

- [ ] **Step 4: verificação de ponta a ponta** (spec, seção "Verificação de ponta a ponta")

Se houver Docker/Postgres: `scripts/server-up.sh`, `yarn dev:web` em `frontend/`, e percorra os 7 itens da spec (duas contas com `created_at` antes e depois de 26/10/2026 00:00 BRT, os três caminhos, 409, 403, 400, badge no perfil de outra pessoa sem toast duplicado, 360/768/1280 px). Se não houver Docker, **diga isso** e confira ao menos 360/768/1280 px com um harness Vite temporário (`frontend/.harness`, apagado depois). As queries SQL (`Carregar`, `Gravar`, `Stats`) só ficam provadas com Postgres real: registre no PR qual caso foi o seu.

- [ ] **Step 5: revisão** — skill `superpowers:requesting-code-review` (subagente) contra a spec e este plano; trate com `superpowers:receiving-code-review`.

- [ ] **Step 6: apagar o temporário e commitar**

```bash
rm -f frontend/postcss.config.mjs
git add changelog/next.md docs/superpowers/plans/2026-10-27-badge-l.md
git commit -m "docs: changelog da enquete do segundo turno"
```

- [ ] **Step 7: PR** — `git push fork caiolucio360/badge-L` e atualizar o corpo do #317 (`gh pr edit 317 --repo hugoemannuel/concord --body-file ...`) **somente depois da confirmação do usuário**.
