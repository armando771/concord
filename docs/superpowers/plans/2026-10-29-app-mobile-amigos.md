# Plano: App mobile, fatia 2b-2 (amigos e selos de não lida)

Spec: [2026-10-29-app-mobile-amigos-design.md](../specs/2026-10-29-app-mobile-amigos-design.md).
Branch `feat/app-mobile-amigos` (empilhada em `feat/app-mobile-dms`). Cada tarefa: teste primeiro,
código mínimo, verde, commit.

1. **Amigos (lógica)**: `friends/api/friends` completa, `lib/friendLists`, `store/friendsStore`,
   `hooks/useFriendsLive` (recarrega nos eventos `friend:*` e ao reconectar).
2. **Não lidas (lógica)**: `chat/lib/unreadCounts`, `store/unreadStore` (canais/servidores, só na sessão),
   `store/activeRoomStore`, `conversationsStore` com contagem e `markRead`, `hooks/useUnreadLive` (global:
   assina `server:<id>`, conta `message:create` de outras pessoas nos chats fechados).
3. **Selos (UI)**: `UnreadBadge`/`UnreadDot`; `ServerRail` (DMs com número, servidor com ponto),
   `ChannelList` (negrito e ponto), `ConversationRow` (número); `ChatScreen` registra o chat aberto e zera.
4. **Tela de Amigos (UI)**: `FriendRow`, `FriendsTabs`, `AddFriend`, `FriendsScreen` (confirmações
   de remover e bloquear); botão "Amigos" no painel de DMs; rota `/amigos`.
5. **Limpeza e rotas**: `useResetOnSignOut` limpa amigos, não lidas e chat aberto; teste de rotas.
6. **Pré-PR**: `affected-tests pr`, emulador (3 contas), confirmar com o dono antes do push.
