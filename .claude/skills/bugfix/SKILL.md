---
name: bugfix
description: Corrige um bug pela causa raiz, com teste de regressão, refatoração anti-god/CRAP e PR para develop.
argument-hint: <sintoma: o que acontece, o que deveria acontecer, como reproduzir>
disable-model-invocation: true
---

Bug: $ARGUMENTS

Leia e siga **todos** os passos de [docs/ai/pipeline-bugfix.md](../../../docs/ai/pipeline-bugfix.md),
na ordem, respeitando as regras do [AGENTS.md](../../../AGENTS.md).

- Comece pela skill `superpowers:systematic-debugging`: nenhuma correção antes
  de achar a causa raiz.
- O teste que reproduz o bug vem antes da correção e precisa falhar pelo motivo
  do bug (`superpowers:test-driven-development`).
- Feche com `superpowers:verification-before-completion`,
  `superpowers:requesting-code-review` e
  `superpowers:finishing-a-development-branch`, com
  `node scripts/affected-tests.mjs pr` verde. Confirme com o usuário antes de
  push e PR.
