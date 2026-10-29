# Convidar amigos para a call (issue #299)

Objetivo: botão "Convidar amigos" na chamada de canal de voz, modal com busca e
multisseleção, convite em tempo real para o amigo, que aceita ou recusa; aceitou,
entra na call. O backend valida amizade e permissão.

## Arquitetura (regra 4)

Padrões comparados para "convite pendente com expiração e atualização em tempo real":

1. **Pedido pendente em memória com timer de expiração + eventos por usuário**
   (o `lock.go`/knock do repo): estado transitório no `activeCall`, `time.AfterFunc`
   para expirar, `SendToUser` para notificar.
2. **Convite persistido (tabela + job de expiração)**: sobrevive a reinício, mas
   exige migration, varredura e limpeza, para um dado que vale 60 s.
3. **Outbox/fila de notificações**: entrega garantida e reenvio; é exagero para um
   convite efêmero cujo destinatário precisa estar online.

Escolha: o 1. **Segue o padrão existente** (`lock.go`), sem ADR e sem migration.

## Decisões

- Só chamada de canal de voz. DM é 1:1 e o botão não aparece nela.
- Estado: pendente -> aceito | recusado | expirado | cancelado (call acabou).
- Expira em 60 s; recusa dá 30 s de espera antes de convidar a mesma pessoa; no
  máximo 20 pessoas por requisição.
- Aceitar dá o passe `admitted` (vale em sala trancada) e o cliente entra pelo fluxo
  normal (`startChannel`), que valida `ViewChannel|Connect` e "ocupado". Uma porta só.
- Se o convidado entra por outro caminho antes de responder, o convite fecha como
  aceito quando o timer vence; o front também esconde o cartão ao entrar.
- Recusar NÃO usa `Service.Decline` (encerra a chamada).

## Backend (pacote `call`, arquivos novos)

1. `friend_invite.go`: tipos, estado, `InviteFriends`, `AcceptFriendInvite`,
   `DeclineFriendInvite`, `FriendChecker` + `SetFriendChecker`.
2. `friend_invite_handler.go` + rotas `POST /calls/:id/invites`, `/accept`, `/decline`.
3. Toques mínimos: campo `invites` no `activeCall`, campo `friends` no `Service`,
   duas linhas em `closeCall` (cancelar convites), `wire_calls.go`.
4. Eventos: `call:friend_invite` (convidado) e `call:friend_invite_update`
   (convidador e convidado).
5. Testes com fakes (`friend_invite_test.go`): um por critério de aceite.

## Frontend (feature `call`, arquivos novos, sem tocar o `callStore`)

1. `api/callInvites.ts`, `store/callInviteStore.ts`, `lib/callInviteCopy.ts` (todos os
   textos), `lib/callInviteEvents.ts` + `lib/callInviteStart.ts` (molde do
   `arrivalEventsStart.ts`), `lib/inviteFriendsList.ts` (filtro/seleção/resultado).
2. UI: `InviteFriendsButton`, `InviteFriendsModal`, `FriendInviteCard` + host global.
3. Responsivo 360/768/1280, toque e teclado; `web-design-guidelines`.

## Verificação

`node scripts/affected-tests.mjs loop` a cada ciclo; no fim `... pr`.
