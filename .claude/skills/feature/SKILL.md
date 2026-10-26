---
name: feature
description: Implementa uma feature da spec até o PR (worktree, baseline de CRAP, plano, TDD, refatoração anti-god, verificação, review, PR para develop).
argument-hint: <caminho da spec em docs/superpowers/specs/ ou descrição clara>
disable-model-invocation: true
---

Feature: $ARGUMENTS

Leia e siga **todos** os passos de [docs/ai/pipeline-feature.md](../../../docs/ai/pipeline-feature.md),
na ordem, respeitando as regras do [AGENTS.md](../../../AGENTS.md).

- Se a entrada for vaga ou tiver mais de um caminho razoável, pare e proponha
  rodar `/ideia` antes.
- Skills `superpowers:*` em cada etapa, como o pipeline indica:
  `using-git-worktrees`, `writing-plans`, `subagent-driven-development`,
  `test-driven-development`, `verification-before-completion`,
  `requesting-code-review` e `finishing-a-development-branch`.
- Guarde a saída do `node scripts/crap.mjs --files ...` de antes de mexer; ela vai
  no PR junto com a de depois.
- Não termine sem `node scripts/affected-tests.mjs pr` verde e confirme com o
  usuário antes de push e PR.
