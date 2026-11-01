---
paths:
  - "frontend/**/*.ts"
  - "frontend/**/*.tsx"
---

# Frontend TS/React

- Estrutura: `renderer/src/features/<domínio>/{components,hooks,store,lib,api,pages}`,
  o genérico em `shared/{ui,lib,hooks,store,api}`, a casca em `app/`. O main do
  Electron fica em `src/main/<responsabilidade>/`. Ver
  [docs/ai/arquitetura.md](../../docs/ai/arquitetura.md).
- **Responsivo sempre**: 360 px até telas largas, mobile-first com Tailwind,
  sem largura fixa, ações que não dependem de hover. Ver
  [docs/ai/exemplos/responsivo.md](../../docs/ai/exemplos/responsivo.md).
- Um store Zustand por responsabilidade; não adicione campos a `callStore`,
  `chatStore` ou `serverStore` (god stores): crie um store novo na feature.
- Lógica em `lib/` (função pura + `x.test.ts` ao lado); componente não faz
  `fetch` nem regra de negócio.
- Imports relativos, como o resto do código (o alias `@renderer` existe, mas
  não é usado).
- Cores e espaçamentos pelos tokens de `assets/main.css` (`@theme`).
- Não rode `prettier --write` em arquivos existentes (o checkout é CRLF e ele
  reescreve todas as linhas). No lint, só os erros (`severity 2`) importam.
- Skills: [composition-patterns](../skills/composition-patterns/SKILL.md)
  (componentes com props demais), [react-best-practices](../skills/react-best-practices/SKILL.md)
  (re-render, bundle), [web-design-guidelines](../skills/web-design-guidelines/SKILL.md)
  (revisão de UI antes do PR).
