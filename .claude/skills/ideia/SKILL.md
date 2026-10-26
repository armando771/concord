---
name: ideia
description: Transforma uma ideia vaga numa spec aprovada (brainstorming, pesquisa de arquitetura, ADR), pronta para /feature.
argument-hint: <a ideia, em texto livre>
disable-model-invocation: true
---

Ideia: $ARGUMENTS

Leia e siga **todos** os passos de [docs/ai/pipeline-ideia.md](../../../docs/ai/pipeline-ideia.md),
na ordem, respeitando as regras do [AGENTS.md](../../../AGENTS.md).

- Comece invocando a skill `superpowers:brainstorming` e conduza por ela (uma
  pergunta por vez, 2–3 abordagens, design aprovado por seções).
- A pesquisa de arquitetura segue [docs/ai/arquitetura.md](../../../docs/ai/arquitetura.md#escolhendo-a-arquitetura-de-uma-feature)
  e vai para o ADR quando fugir do padrão.
- Não escreva código de produção. O resultado é a spec em
  `docs/superpowers/specs/` aprovada pelo usuário. No fim, ofereça rodar
  `/feature <caminho da spec>`.
