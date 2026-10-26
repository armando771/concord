---
paths:
  - "backend/**/*.go"
---

# Backend Go

- Estrutura: `internal/<domínio>/{model,repository,service,handler,routes}.go`; uma
  responsabilidade extra = um arquivo próprio no domínio; infra em
  `internal/platform/`. Ligação em `cmd/wire_<área>.go`. Ver
  [docs/ai/arquitetura.md](../../docs/ai/arquitetura.md).
- Interfaces pequenas declaradas por quem consome. Nada de passar
  `*outro.Service` inteiro quando um método basta.
- Erros: `fmt.Errorf("contexto: %w", err)`, sentinelas `var ErrX = errors.New(...)`
  comparadas com `errors.Is`. Handler traduz erro de domínio em status HTTP; o
  service não conhece HTTP.
- Sem dependência nova no `go.mod` sem ADR. Testes só com a stdlib.
- Comentários e mensagens de log em português, como o resto do código.
- `gofmt` só nos arquivos que você criou ou mudou (o checkout é CRLF; rodar no
  repo todo reescreve centenas de arquivos).
- Migrations: próximo número livre em `backend/migrations/`, sempre `up` e `down`
  (`node scripts/check-migrations.mjs` confere duplicados).
- Skills: [golang-testing](../skills/golang-testing/SKILL.md),
  [golang-concurrency](../skills/golang-concurrency/SKILL.md) (goroutine, canal,
  mutex), [golang-security](../skills/golang-security/SKILL.md) (entrada do
  usuário, arquivos, SQL), [golang-refactoring](../skills/golang-refactoring/SKILL.md).
