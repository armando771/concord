# App mobile, fatia 2b-2: amigos e selos de não lida

Terceiro PR da fatia Chat do [roadmap](2026-10-27-app-mobile-roadmap-design.md) (2a: #361; 2b-1: #363;
2c: push). Depende do #363. Referência: o botão "Amigos" do topo do painel de DMs no desktop e o
[ADR 0007](../../adr/0007-navegacao-mobile-uma-coluna.md).

## Objetivo

1. Uma tela **Amigos** (botão no topo do painel de DMs) com as abas Online, Todos, Pendentes e
   Bloqueados, mais "Adicionar amigo" por nome de usuário, com as ações de cada lista.
2. **Selos de não lida**: nas DMs vêm do servidor (sobrevivem a fechar o app); nos servidores e
   canais contam só o que chega com o app aberto, como o desktop.

## Decisões (com o porquê)

- **Só as DMs têm não lida persistida no backend** (`unread_count` na lista e
  `POST /conversations/:id/read`); servidor e canal são contados no cliente. Por isso o selo de
  servidor/canal zera ao reabrir o app, igual ao desktop; a spec não promete mais que isso.
- **Selos**: DMs mostram número vermelho (por conversa e a soma no ícone de DMs do trilho);
  servidor mostra um ponto branco no ícone e o nome do canal em negrito, sem número (Discord).
- **Contagem ao vivo**: `message:create` de outra pessoa conta +1 se a conversa/canal não está aberto
  (a tela aberta se registra num `activeRoomStore`); abrir o chat zera (DM já chama `read`).
  O app assina a sala `server:<id>` de cada servidor para receber as mensagens dos canais.
- **Amizade ao vivo**: qualquer evento `friend:*` ou `relationship:blocked` recarrega as listas
  (o desktop faz igual; o servidor não diz qual lista mudou).
- **A tela de Amigos abre por cima da lista** (rota própria, voltar no topo), como o chat.
- Amigos da busca de DMs (2b-1) passam a usar a mesma API e o mesmo store.
- Sem dependência nova nem ADR novo (segue 0015 e 0007).

## Arquitetura (arquivos e pastas)

```
mobile/app/(app)/amigos.tsx                 tela de Amigos (voltar no cabeçalho)
mobile/src/features/
  friends/
    api/friends.ts            + listPending, send/accept/decline/cancel/remove, listBlocked, block/unblock
    lib/friendLists.ts        filtra Online/Todos/Pendentes/Bloqueados, ordena, resultado do pedido
    store/friendsStore.ts     amigos, pendentes, bloqueados, status; load/reload e ações
    hooks/useFriendsLive.ts   recarrega nos eventos friend:* e na reconexão
    components/FriendsScreen.tsx FriendsTabs.tsx FriendRow.tsx AddFriend.tsx
  chat/
    store/unreadStore.ts      DMs (do servidor + ao vivo) e servidores/canais (só na sessão)
    store/activeRoomStore.ts  qual chat está aberto agora
    lib/unreadCounts.ts       regras: conta, zera, soma
    components/UnreadBadge.tsx
  servers/components/ServerRail.tsx ChannelList.tsx   passam a mostrar os selos
  chat/components/DirectMessages.tsx ConversationRow.tsx  botão "Amigos" no topo e selo por conversa
```

Estrutura por feature como o desktop; stores novos e pequenos; nada em god stores.

## Fluxo de dados

1. **Amigos**: ao abrir a tela, `friendsStore.load()` busca `/friends`, `/friends/pending` e
   `/friends/blocked`; "Online" filtra os amigos pelo status do `presenceStore`.
2. **Ações** (mandar mensagem abre/cria a DM; aceitar `PUT /friends/:u/accept`, recusar `.../decline`,
   cancelar `DELETE /friends/request/:u`, remover `DELETE /friends/:u`, bloquear `PUT /users/:id/block`,
   desbloquear `DELETE ...`): chama a API e recarrega as listas; falha mostra aviso e mantém a lista.
   Remover e bloquear pedem confirmação.
3. **Adicionar**: `POST /friends/request {username}`; resultado `sent` ("Pedido enviado") ou
   `accepted` (já havia um pedido dele: viram amigos). Erros por status (404 usuário, 409 já amigo...).
4. **Não lidas**: ao carregar a lista de DMs, `unread_count` alimenta o `unreadStore`; `message:create`
   conta ao vivo; abrir o chat zera (`activeRoomStore` + `read`). Servidor/canal: contagem só de
   `message:create` com `channel_id` quando o canal não está aberto.
5. Logout limpa os stores novos (o `useResetOnSignOut` já existente).

## Erros

Cada lista mostra "Não foi possível carregar" com tentar de novo; falha de ação: aviso curto sem
perder a lista; sem rede os botões ficam desativados.

## Responsivo

Uma coluna a 360 px; abas roláveis na horizontal; alvos ≥ 44 dp; o campo de "Adicionar amigo" sobe
com o teclado (mesmo `keyboardVerticalOffset`).

## Textos (para aprovação do dono)

Reaproveitados do desktop quando existem ("Amigos", "Online", "Todos", "Pendentes", "Bloqueados",
"Adicionar amigo"). **Novos, a aprovar:**

- Vazios: "Nenhum amigo online agora." / "Você ainda não tem amigos." / "Nenhum pedido pendente." /
  "Ninguém bloqueado."
- Ações: "Mensagem", "Aceitar", "Recusar", "Cancelar pedido", "Remover amigo", "Bloquear", "Desbloquear"
- Confirmações: "Remover {nome} dos amigos?" e "Bloquear {nome}?" com "Confirmar" e "Cancelar"
- Adicionar: campo "Nome de usuário", botão "Enviar pedido", sucesso "Pedido enviado para {nome}.",
  amigos na hora "Agora você e {nome} são amigos.", erros "Usuário não encontrado.", "Vocês já são
  amigos.", "Não foi possível enviar o pedido."
- Pendentes: "Pedido recebido" / "Pedido enviado"
- Falhas: "Não foi possível carregar os amigos." e "Não foi possível concluir a ação."
- Leitor de tela dos selos: "{n} mensagens não lidas" e "Mensagens não lidas"

## Testes (TDD, só o que importa)

- `friendLists`: Online usa a presença, ordem alfabética, pendentes separados em recebido/enviado.
- `friendsStore`: carregar, falhas isoladas por lista, cada ação recarrega, bloquear tira da lista de amigos.
- `useFriendsLive`: evento `friend:*` recarrega; reconexão recarrega.
- `unreadCounts`/`unreadStore`: conta só de outra pessoa e só com o chat fechado; abrir zera; soma das DMs;
  servidor em ponto; logout limpa.
- Componentes: `FriendsScreen` (abas, vazios, ações com confirmação), `AddFriend` (sucesso, `accepted`, erros),
  `UnreadBadge`, `ServerRail`/`ConversationRow` com selo.
- Rotas: botão "Amigos" abre `/amigos`. CRAP ≤ 15.

## Fora de escopo

Notificação do sistema e push (2c); amigos em comum, perfil da pessoa, convites de servidor; atividade/jogo;
ouvir "digitando"; menções (@) com selo próprio.

## Verificação de ponta a ponta

1. `node scripts/affected-tests.mjs pr` verde.
2. Backend local (banco descartável) com 3 contas: mandar, aceitar, recusar e cancelar pedidos aparecem nos dois
   lados em tempo real; bloquear/desbloquear; remover; "Online" segue a presença.
3. Mensagem de outra conta numa DM fechada acende o selo (lista e ícone de DMs) e abrir zera; mensagem num canal
   fechado acende o ponto do servidor; fechar e reabrir o app mantém o selo das DMs e zera o de servidor.
4. Emulador a 360 px: sem corte, teclado não cobre o campo de adicionar.
