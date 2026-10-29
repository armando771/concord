# Plano: App mobile, fatia 2a (casca e chat dos canais de texto)

Spec: [2026-10-28-app-mobile-chat-canais-design.md](../specs/2026-10-28-app-mobile-chat-canais-design.md).
Branch `feat/app-mobile-chat` (empilhada em `feat/app-mobile`). Cada tarefa: teste
primeiro (falhando pelo motivo certo) → código mínimo → verde → commit. Código novo
quase todo; arquivos existentes tocados (baseline de CRAP: trivial, só layouts/rotas):
`app/(app)/_layout.tsx`, `tests/routes.test.tsx`, `AccountPanel.tsx`.

Eventos do WebSocket (confirmados no desktop): `message:create` e `message:update`
trazem `payload.message`; `message:delete` traz `message_id` e `channel_id`.

1. **Lógica pura** (`chat/lib`, `servers/lib`): `messageList` (funde/deduplica por id,
   ordena, cursor `before`, remove), `messageGroups` (autor + janela de tempo + dia),
   `channelSections` (texto/voz, ordem).
2. **API**: `servers/api/{servers,channels}.ts`, `chat/api/messages.ts` (porte enxuto).
3. **Stores**: `selectedServerStore`, `voice/store/voiceControlsStore` (fone mudo ⇒ mic
   mudo; persistido no secure-store).
4. **Hooks**: `useServers`, `useChannelMessages` (histórico, sala `channel:<id>`, merge
   WS+POST, refaz a busca ao reconectar).
5. **UI**: `Avatar`, `ServerRail`, `ChannelList`, `VoiceControls`, `UserPanel`,
   `MessageItem`, `MessageList`, `Composer`, `ChannelHeader`.
6. **Rotas**: `(app)/_layout` vira Stack; `index` (trilho + lista + painel), `canal/[channelId]`,
   `conta`; remove `(tabs)`; atualiza o teste de rotas.
7. **Pré-PR**: `affected-tests pr`, emulador (2 contas), 360/768 px; confirmar com o dono antes do push.
