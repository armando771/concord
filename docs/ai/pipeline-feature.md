# Pipeline `/feature`: da spec ao PR

Entrada: o caminho de uma spec (`docs/superpowers/specs/...`) ou uma descrição
clara. Se a descrição for vaga ou tiver vários caminhos possíveis, rode antes o
[`/ideia`](pipeline-ideia.md).

> Claude: as skills `superpowers:*` vêm do plugin superpowers (ver
> [skills.md](skills.md)). Outros agentes: siga o resumo de cada passo.

## Passos

1. **Branch isolada**: skill `superpowers:using-git-worktrees`.
   `git fetch origin` e branch `feat/<slug>` a partir de `origin/develop`.
   Nunca trabalhe direto em `main` ou `develop`.
2. **Contexto**: leia a spec, o [AGENTS.md](../../AGENTS.md) e o código que vai
   mudar. Siga os padrões existentes da área.
3. **Arquitetura**: se a spec não decidiu, siga
   [arquitetura.md](arquitetura.md#escolhendo-a-arquitetura-de-uma-feature):
   pesquise 2–3 padrões, escolha e registre um ADR se fugir do padrão. Decida
   onde cada arquivo novo mora (`features/<domínio>/...`, `internal/<domínio>/`).
4. **Baseline**: antes de mexer, meça os arquivos que vai tocar e guarde a saída
   para o PR:
   ```bash
   node scripts/crap.mjs --files <arquivos que vai alterar>
   ```
   Anote os god files (> 400 linhas, ver [exemplos/god-files.md](exemplos/god-files.md)).
   A extração da responsabilidade que você vai tocar entra no plano.
5. **Plano**: skill `superpowers:writing-plans` →
   `docs/superpowers/plans/AAAA-MM-DD-<slug>.md`. Tarefas pequenas, cada uma com
   teste primeiro. Os refactors estruturais vêm **antes** das mudanças de
   comportamento, em commits próprios.
6. **Execução com TDD**: skill `superpowers:subagent-driven-development` (ou
   `superpowers:executing-plans`), e em cada tarefa
   `superpowers:test-driven-development`: teste falhando pelo motivo certo →
   código mínimo → verde → refatorar. A cada ciclo:
   ```bash
   node scripts/affected-tests.mjs loop
   ```
7. **Refatoração obrigatória**: toda função tocada fica com CRAP ≤ 15 e todo god
   file tocado sai menor ([exemplos/crap.md](exemplos/crap.md),
   [exemplos/god-files.md](exemplos/god-files.md)).
8. **UI**: confira o responsivo em 360/768/1280 px ([exemplos/responsivo.md](exemplos/responsivo.md))
   e rode a skill `web-design-guidelines` nos arquivos de UI alterados.
9. **Pré-PR**:
   ```bash
   node scripts/affected-tests.mjs pr   # afetados + vet/typecheck + estrutura + CRAP
   ```
   Skill `superpowers:verification-before-completion`: só diga que está pronto
   com a saída dos comandos na mão.
10. **Revisão**: skill `superpowers:requesting-code-review` (revisor num subagente,
    com contexto limpo, contra a spec e o plano). Trate o retorno com
    `superpowers:receiving-code-review`: corrija o que afeta correção ou
    requisito; o resto é opcional.
11. **PR**: skill `superpowers:finishing-a-development-branch`. **Confirme com o
    usuário antes de dar push e abrir o PR.**
    - Base `develop`; título `feat(<área>): ...` em português.
    - Corpo no [modelo do repo](../../.github/pull_request_template.md): o que mudou,
      como testar, CRAP antes/depois, ADR, screenshots responsivos.
    - Sem atribuição de IA em commits e PR (regra do repo).
