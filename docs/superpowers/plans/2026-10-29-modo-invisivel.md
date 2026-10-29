# Modo Invisível - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar e corrigir o modo invisível de acordo com a issue #407: permitir selecionar "Invisível" nas configurações de status do usuário (Configurações → Perfis e busca de configurações), garantir que o usuário apareça offline para os outros membros e amigos em todos os locais, não vazar eventos de presença enquanto invisível (nem ao desconectar), e diferenciar internamente usuários realmente desconectados daqueles que estão invisíveis.

**Architecture:**
- Backend:
  - Em `internal/platform/websocket/hub.go`, refinar `Unregister` para que desconexões de usuários cujo status escolhido seja `StatusInvisible` não façam broadcast de `StatusOffline` aos outros clientes.
  - Adicionar métodos explícitos no `Hub` para diferenciar usuários conectados-invisíveis de usuários fisicamente desconectados: `IsConnected(userID)`, `IsInvisible(userID)`, `ChosenStatus(userID)`.
  - Testes unitários cobrindo o ciclo de vida do usuário invisível no backend.
- Frontend:
  - Em `features/settings/lib/settingsNav.ts`: adicionar termos de busca para status (`status`, `invisível`, `invisivel`, `presença`, `online`, `ausente`, `não perturbe`).
  - Em `features/settings/components/profile/tiles/ProfileTiles.tsx`: adicionar o tile "Status" exibindo o status atual (com ícone e rótulo) que abre o editor de status.
  - Em `features/settings/components/profile/modals/`: criar `StatusModal.tsx` com as 4 opções (`online`, `idle`, `dnd`, `invisible`), suas descrições e ícones (`StatusIcon`), permitindo selecionar e aplicar na hora com `changeMyStatus`.
  - Testes unitários para o novo modal e tile no frontend.

---

### Task 1: Backend - Diferenciação interna e discrição no Hub WebSocket

**Files:**
- Modify: `backend/internal/platform/websocket/hub.go`
- Test: `backend/internal/platform/websocket/hub_test.go`

- [ ] Adicionar testes em `hub_test.go` para:
  - `IsConnected`, `IsInvisible` e `ChosenStatus` quando o usuário está offline, online e invisível.
  - Garantir que desconectar um usuário com `StatusInvisible` não emita broadcast de `StatusOffline`.
- [ ] Implementar `IsConnected`, `IsInvisible` e `ChosenStatus` no `Hub`.
- [ ] Ajustar `Unregister` para respeitar `wasInvisible`.
- [ ] Rodar `cd backend; go test ./internal/platform/websocket/...`.

---

### Task 2: Frontend - Navegação e busca por Status nas Configurações

**Files:**
- Modify: `frontend/src/renderer/src/features/settings/lib/settingsNav.ts`
- Test: `frontend/src/renderer/src/features/settings/lib/settingsNav.test.ts`

- [ ] Adicionar teste em `settingsNav.test.ts` para verificar se termos como "status" e "invisível" encontram a seção `profiles`.
- [ ] Atualizar as palavras-chave da seção `profiles` em `settingsNav.ts`.
- [ ] Rodar vitest em `settingsNav.test.ts`.

---

### Task 3: Frontend - Tile e Modal de Status em Configurações → Perfis

**Files:**
- Create: `frontend/src/renderer/src/features/settings/components/profile/modals/StatusModal.tsx`
- Modify: `frontend/src/renderer/src/features/settings/components/profile/modals/ProfileEditModal.tsx`
- Modify: `frontend/src/renderer/src/features/settings/components/profile/tiles/ProfileTiles.tsx`
- Test: `frontend/src/renderer/src/features/settings/components/profile/modals/StatusModal.test.tsx`
- Test: `frontend/src/renderer/src/features/settings/components/profile/tiles/ProfileTiles.test.tsx`

- [ ] Criar teste para `StatusModal`: renderização das opções (Online, Ausente, Não perturbe, Invisível com descrição), seleção de "Invisível" e chamada a `changeMyStatus`.
- [ ] Criar `StatusModal.tsx` seguindo o design system do app (Tailwind, `CARD_BG`, `STATUS_META`, `StatusIcon`).
- [ ] Integrar no `ProfileEditModal.tsx` e adicionar `StatusTile` em `ProfileTiles.tsx`.
- [ ] Rodar testes do vitest e garantir que passam.

---

### Task 4: Verificação final e CRAP

- [ ] Executar `node scripts/crap.mjs --files ...` e garantir CRAP <= 15 em todas as funções tocadas.
- [ ] Executar typecheck e suíte de testes.
