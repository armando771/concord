# Padronização do código gerado por agentes de IA

## Objetivo

Todo código escrito por agentes (Claude, Gemini, Codex...) segue o mesmo padrão:
arquitetura decidida e registrada, sem god services, CRAP ≤ 15 em tudo que for
tocado e uma pipeline de testes que roda só o necessário. O fluxo da ideia ao PR
é padronizado em três comandos: `/ideia`, `/feature` e `/bugfix`.

## Decisões

- **Fonte única: `AGENTS.md`** (padrão aberto, lido por Codex e Gemini). O
  `CLAUDE.md` só importa (`@AGENTS.md`), porque o Claude Code ignora o AGENTS.md
  quando existe um CLAUDE.md. O Gemini lê o AGENTS.md via `.gemini/settings.json`.
- Seguindo a Anthropic: AGENTS.md com menos de 200 linhas, só com o que o agente
  não descobre lendo o código. Regras específicas de backend e frontend vão em
  `.claude/rules/` com `paths:`. Procedimentos de várias etapas vão em
  skills/comandos.
- Comandos para **Claude** (`.claude/skills/<nome>/SKILL.md`, com
  `disable-model-invocation: true`) e **Gemini** (`.gemini/commands/<nome>.toml`).
  Os dois são wrappers finos que mandam seguir `docs/ai/pipeline-<nome>.md`, para
  existir um procedimento só.
- **CRAP garantido por script**, sem hook e sem CI: `node scripts/crap.mjs` falha
  se alguma função tocada passar de 15. Os comandos rodam o script antes
  (baseline) e depois, e o relatório vai no PR.
- **Arquitetura por feature, com ADR**: em `/ideia` e `/feature` o agente pesquisa
  2–3 padrões na internet, compara com o monólito modular atual e registra a
  escolha em `docs/adr/NNNN-titulo.md`.
- God files que já existem só são refatorados quando alguém tocar neles.
- O conteúdo do CLAUDE.md da branch `docs/claude-md` (comandos, arquitetura,
  pegadinhas) entra no AGENTS.md, enxugado.

## CRAP

`CRAP(m) = comp(m)² × (1 − cov(m))³ + comp(m)`, com cobertura de 0 a 1.

- **Complexidade ciclomática**: 1 + `if`, `for`, `case` (exceto default), `&&`,
  `||`. No TS também contam `while`, `do`, `catch`, `?:` e `??`.
- **Cobertura da função**: fração das instruções (statements) da função que
  rodaram nos testes.
  - Go: blocos do `-coverprofile` que estão dentro da função.
  - TS: `statementMap` do `coverage-final.json` (istanbul, `@vitest/coverage-v8`).
- **Função tocada**: o intervalo de linhas dela cruza alguma linha alterada no
  `git diff` contra a base (padrão `origin/develop`; commits + working tree).
- Funções tocadas com CRAP > 15 fazem o script falhar. As outras funções acima
  de 15 nos arquivos tocados aparecem como aviso.
- Modos:
  - `--files a b` mede arquivos inteiros (baseline antes de mexer).
  - `--base <ref>` mede o diff.
  - `--json` gera saída para máquina.

Peças:

- `backend/tools/crap` (Go, só stdlib `go/ast`): lista as funções de arquivos Go
  com início, fim, complexidade e cobertura, a partir de um coverprofile.
- `scripts/lib/diff.mjs`: parse do diff unificado → linhas alteradas por arquivo.
- `scripts/lib/crap.mjs`: fórmula, seleção das funções tocadas e relatório.
- `scripts/lib/ts-functions.mjs`: funções TS com complexidade (compiler API do
  `typescript` do frontend) e cobertura vinda do istanbul.
- `scripts/crap.mjs`: CLI que roda a cobertura só dos pacotes Go e dos testes TS
  afetados.

## Pipeline de testes (`scripts/affected-tests.mjs`)

| Etapa | Quando | O que roda |
|---|---|---|
| `loop` | a cada ciclo TDD | testes afetados pelo diff |
| `pr` | antes do PR | afetados + `go vet` / `yarn typecheck` + CRAP |
| `full` | mudou código compartilhado (`internal/websocket`, `internal/database`, `internal/permission`, `cmd/`, `renderer/src/api`, `renderer/src/lib`, `go.mod`, `package.json`) ou a pedido | `go test ./...` + `yarn test` + `node --test scripts/*.test.mjs` |

Como os afetados são mapeados:

- Go: pacotes alterados + pacotes que importam deles (fecho reverso via
  `go list -json ./...`).
- TS: `vitest related <arquivos>`.
- `scripts/*.mjs`: o `.test.mjs` de mesmo nome.

## Regra anti-god

Ao tocar num arquivo, é obrigatório extrair a responsabilidade alterada para uma
unidade própria no mesmo PR se o arquivo tiver qualquer um destes sinais:

- mais de 400 linhas;
- mais de 7 dependências injetadas;
- mais de 1 domínio misturado.

Exemplos atuais: `call/service.go`, `callStore.ts`, `chatStore.ts`,
`ChatPane.tsx`, `ServerSidebar.tsx`.

## Comandos

- `/ideia <texto>`: superpowers:brainstorming → pesquisa de arquitetura + ADR →
  spec em `docs/superpowers/specs/` → sugere `/feature <spec>`.
- `/feature <spec|descrição>`: branch/worktree → baseline CRAP → writing-plans →
  TDD (subagent-driven-development) → anti-god + CRAP → `affected-tests pr` →
  requesting-code-review → verification-before-completion →
  finishing-a-development-branch (PR para `develop`).
- `/bugfix <descrição>`: systematic-debugging → teste que reproduz o bug falhando
  → correção mínima → anti-god + CRAP → `affected-tests pr` → verification → PR.

O PR leva uma tabela de CRAP antes/depois e não leva atribuição de IA (regra do
repo).

## Fora de escopo

Hooks, job de CI, refatorar god files existentes que não forem tocados.
