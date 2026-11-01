# Plano: App mobile, fatia 2b-1 (mensagens diretas)

Spec: [2026-10-29-app-mobile-dms-design.md](../specs/2026-10-29-app-mobile-dms-design.md).
Branch `feat/app-mobile-dms` (empilhada em `feat/app-mobile-chat`). Cada tarefa: teste primeiro,
código mínimo, verde, commit. Estrutural antes de comportamento.

1. **Estrutural**: `useChannelMessages` → `useRoomMessages({ kind, id })` (só renomeio; os testes
   do canal seguem iguais).
2. **API e lógica pura**: `chat/api/conversations`, `messages` (+ conversa), `friends/api/{friends,presence}`;
   `chat/lib/conversationList` (título, ordem, `applyMessage`, filtro sem acento, amigos sem DM, ids de presença).
3. **Stores**: `friends/store/presenceStore` + `lib/presenceStatus`; `chat/store/conversationsStore`.
4. **Hook**: `useRoomMessages` com conversa (sala `conversation:<id>`, filtro por `conversation_id`,
   envio, marcar como lida ao abrir e a cada mensagem nova).
5. **UI**: `PresenceDot`, `ConversationRow`, `DmSearch`, `DirectMessages`; `Composer`/`ChannelHeader`/`ChatScreen`
   aceitam canal, DM e grupo; `HomeScreen` troca o "em breve" pelas DMs.
6. **Rotas e limpeza**: `app/(app)/dm/[conversationId]`; `useResetOnSignOut` limpa conversas e presença;
   teste de rotas.
7. **Pré-PR**: `affected-tests pr`, emulador (2 contas), confirmar com o dono antes do push.
