# App mobile, fatia 2b-1: mensagens diretas (lista, presença, busca e chat)

Segundo PR da fatia Chat do [roadmap](2026-10-27-app-mobile-roadmap-design.md) (2a: PR #361;
2b-2: amigos e não lidas; 2c: push). Depende do #361. Referência: a primeira captura do
desktop do dono (painel de DMs) e o [ADR 0007](../../adr/0007-navegacao-mobile-uma-coluna.md).

## Objetivo

Tocar no ícone de DMs do trilho e ver a lista de conversas (1 a 1 e em grupo), com a
bolinha de presença, uma busca "Encontre ou comece uma conversa" e abrir qualquer conversa
no mesmo chat em tela cheia dos canais: ler, receber em tempo real e enviar texto.

## Decisões (com o porquê)

- **Reaproveita o chat dos canais**: o hook de mensagens vira `useRoomMessages` para canal
  *ou* conversa (mesma lista, mesmo campo de envio, mesmo tempo real); só muda a API e a sala
  (`conversation:<id>`). Commit estrutural primeiro, comportamento depois.
- **Grupos entram na lista e no chat** (como no desktop, `include_groups=1`); criar, renomear e
  gerenciar grupo fica fora.
- **Presença**: `GET /presence?ids=` ao carregar a lista e `presence:update` do WebSocket
  depois. Cores dos tokens: online verde, ausente amarelo, não perturbe vermelho, offline cinza.
  Só nas DMs 1 a 1 (grupo mostra "N membros").
- **Busca**: filtra a lista pelo nome e, com texto digitado, mostra também amigos sem conversa
  (só leitura: `GET /friends`); tocar num deles chama `POST /conversations` (get-or-create) e abre.
  A tela de amigos (pedidos, bloquear, adicionar) é o 2b-2.
- **Ao abrir uma conversa, marca como lida** (`markConversationRead`), para o desktop não
  continuar mostrando não lida. Os selos de não lida do app ficam no 2b-2.
- Lista em tempo real: `message:create` com `conversation_id` sobe a conversa para o topo e
  atualiza a última mensagem; conversa desconhecida refaz a busca da lista.
- Sem dependência nova nem ADR novo (segue 0015 e 0007).

## Arquitetura (arquivos e pastas)

```
mobile/app/(app)/dm/[conversationId].tsx     chat da conversa (voltar no cabeçalho)
mobile/src/features/
  chat/
    api/conversations.ts       listConversations, getOrCreateConversationWith, markConversationRead
    api/messages.ts            + listConversationMessages, sendConversationMessage
    hooks/useRoomMessages.ts   (era useChannelMessages) canal ou conversa
    lib/conversationList.ts    ordena, aplica message:create, filtra por busca, nome de exibição
    store/conversationsStore.ts  lista + status + load/applyMessage/reset
    components/ConversationList.tsx ConversationRow.tsx DmSearch.tsx
    components/ChatScreen.tsx  recebe o "alvo" (canal ou conversa), título e rótulo do campo
  friends/
    api/friends.ts             listFriends (leitura)
    api/presence.ts            fetchPresence
    store/presenceStore.ts     status por usuário; load(ids) e update do WS
    components/PresenceDot.tsx
  servers/components/HomeScreen.tsx  o painel "em breve" passa a ser a lista de DMs
```

Estrutura por feature como o desktop; stores novos e pequenos; nada é adicionado a god stores.

## Fluxo de dados

1. Tocar no ícone de DMs: `conversationsStore.load()` (`/conversations?include_groups=1`);
   com a lista, `presenceStore.load(ids dos outros usuários das DMs 1 a 1)`.
2. Digitar na busca: filtra as conversas por nome (grupo: nome do grupo ou os nomes dos
   membros); busca `/friends` uma vez e mostra "Amigos" sem conversa abaixo.
3. Tocar numa conversa: `router.push('/dm/<id>')` com o título; o chat carrega
   `/conversations/:id/messages`, assina `conversation:<id>`, marca como lida.
4. Tocar num amigo sem conversa: `getOrCreateConversationWith(userId)` e abre a conversa.
5. `message:create`/`message:update`/`message:delete` e `presence:update` chegam pelo
   `onWsEvent`; ao reconectar, refaz a lista e a página mais recente do chat aberto.

## Erros

Falha ao carregar a lista: aviso e "Tentar de novo". Falha ao abrir um amigo: aviso curto e a
busca continua. Envio e histórico: mesmos avisos do chat dos canais.

## Responsivo

Igual ao 2a: uma coluna a 360 px, alvos ≥ 44 dp, teclado não cobre o campo (mesmo
`keyboardVerticalOffset` da área segura), lista longa com `FlatList`.

## Textos (para aprovação do dono)

Reaproveitados do desktop: "Mensagens diretas", "Encontre ou comece uma conversa", "Amigos"
(título da seção da busca), "N membros". **Novos, a aprovar:**

- Lista vazia: "Você ainda não tem conversas."
- Busca sem resultado: "Nada encontrado."
- Falha da lista: "Não foi possível carregar as conversas." + "Tentar de novo"
- Falha ao abrir conversa com amigo: "Não foi possível abrir a conversa."
- Campo de envio da DM: "Mensagem para @nome" (grupo: "Mensagem para o grupo")
- Leitor de tela da presença: "Online", "Ausente", "Não perturbe", "Offline"

## Testes (TDD, só o que importa)

- `conversationList`: ordem por atividade, `message:create` sobe e atualiza, conversa
  desconhecida pede refetch, filtro por nome (grupo pelos membros), nome de exibição.
- `conversationsStore` e `presenceStore`: carregar, falha, update por evento, reset ao sair.
- `useRoomMessages`: os testes de hoje do hook de canal, agora também para conversa
  (sala certa, filtro por `conversation_id`, marca como lida ao abrir).
- Componentes: `ConversationList` (toque abre, vazio, erro), `DmSearch` (filtra, amigo sem
  conversa abre), `PresenceDot` (cor e rótulo).
- Roteamento: ícone de DMs mostra a lista; `/dm/<id>` abre o chat.
- CRAP ≤ 15 nas funções tocadas.

## Fora de escopo

Selos de não lida, tela de amigos e pedidos, bloquear (2b-2); criar/renomear/gerenciar grupos,
ocultar conversa, chamada na DM, convite de call, anexos, reações, respostas, atividade/jogo;
push (2c).

## Verificação de ponta a ponta

1. `node scripts/affected-tests.mjs pr` verde.
2. Backend local (banco descartável) com 2 contas: a lista mostra DM e grupo com presença; DM
   nova aparece no topo ao receber mensagem; a busca acha amigo sem conversa e abre; mensagem
   enviada de um lado chega no outro em tempo real; marcar como lida reflete no outro cliente.
3. Emulador a 360 px: sem corte, teclado não cobre o campo.
