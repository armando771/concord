# Convite da call no privado (continuação da issue #299)

O convite de amigos (PR #305) virava um cartão flutuante + aviso do SO e o botão
ficava no dock da chamada. Mudanças pedidas:

1. Botão "Convidar amigos" na linha do canal de voz da barra lateral (entre o
   balão de chat e a engrenagem), não mais no dock.
2. O convite vira uma **mensagem na DM** com o amigo (não há mais cartão global).
3. Visual de cartão dentro da mensagem (referência: Discord).

## Arquitetura (regra 4)

Como guardar a mensagem de convite de forma estruturada (`call_id`, canal,
servidor, convidador):

1. **`system_kind` + JSON no `content`**: sem migration, mas o `content` aparece em
   notificações, prévia da lista de DMs e busca (mostraria JSON cru).
2. **Tabela própria de convites (como `polls`)**: normalizada, mas exige tabela,
   repository e join em toda listagem, para 4 campos.
3. **Coluna `messages.call_invite JSONB`** (como `gif_metadata`, já no repo): o
   `content` fica legível ("Convidou você para a call") e o cartão lê o objeto
   embutido. Uma coluna nula, sem join. **Escolha: 3** (segue `gif_metadata`; sem ADR).
   Migration `000065`. O autor é o convidador (mensagem normal dele, não
   `system_kind`), então o avatar do cartão e as notificações de DM funcionam sem
   código novo. Mensagem com `call_invite` não é editável.

## Decisões

- Quem posta: `call` declara a interface `InviteDMPoster`; o `cmd/wire_calls.go`
  liga um adaptador (conversation `GetOrCreateWith` + `message.CreateCallInviteMessage`).
  `GetOrCreateWith` aplica `CanDirectMessage` ao criar a DM.
- **Validade**: derivada do estado da call. `GET /calls/:id/invite` -> `{valid}`
  (call existe e não acabou). Quando a call acaba, `call:invite_ended {call_id}`
  vai para convidador e convidados (em memória) e o cartão vira "Convite
  inválido" sozinho. Mensagens antigas consultam o endpoint ao renderizar (call
  que não existe mais = inválido, sem erro).
- **Sem prazo de 60 s e sem "expirado"**: a mensagem é permanente na DM. Sem
  recusar (não há botão recusar) não existe "cooldown de recusa". Para não
  spammar, "já convidado" vale por 60 s (`inviteResendAfter`) por pessoa/call.
- **Sem "online"**: a DM fica salva e o amigo vê depois; a regra `offline` sai.
- Mantidos: só amigos, bloqueio, fora da call, ocupado em outra call, permissão
  no canal, máx. 20 por requisição, resposta por pessoa. Novo status `failed`
  (a DM não pôde ser postada).
- "Abrir" -> `POST /calls/:id/invites/accept` (dá o passe `admitted` se a pessoa
  foi convidada; call acabada = 404 e o cartão fica inválido) e depois
  `startChannelCall`, como antes. Sem registro do convite (reinício do servidor):
  200 sem passe, a pessoa entra pelo fluxo normal (bate na porta se trancada).
  Some o `decline`.
- Convidador vê o cartão igual, **sem botão** ("Você convidou para a call").

## Frontend

- `features/chat/components/CallInviteCard.tsx` (cartão), validade num store novo
  `features/call/store/inviteValidityStore.ts`; lógica em `lib/`. `MessageItem`
  renderiza o cartão quando `message.call_invite`.
- Remover: `FriendInviteCard`, `FriendInviteHost`, `callInviteStore.received`,
  `callInviteEvents/Start`, `notifyDesktop` do convite, eventos
  `call:friend_invite*`.
- Sidebar: `InviteFriendsButton` (ícone `UserPlusIcon`) na linha do canal de voz,
  extraída num componente próprio; some do `CallControlsDock`.

## Verificação

`node scripts/affected-tests.mjs loop` a cada ciclo; no fim `... pr`.
