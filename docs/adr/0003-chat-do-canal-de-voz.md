# 0003. Reaproveitar as mensagens de canal para o chat do canal de voz

- Status: aceito
- Data: 2026-10-26

## Contexto

A issue #248 pede um chat de texto para cada canal de voz, como o "Text in
Voice" do Discord: persistente, ligado ao canal, aberto num painel à direita da
chamada, para quem está conectado ou não, com não lidas e menções.

Forças: o chat precisa das mesmas coisas do chat de texto (anexos, reações,
respostas, edição, enquetes, fixadas, "digitando", menções e não lidas); tem que
respeitar os cargos do canal (canal de voz privado não vaza mensagens); não
pode engordar os god stores (`chatStore`, `callStore`, `serverStore`) nem o
`ChatPane`, em que outra frente mexe ao mesmo tempo.

## Opções consideradas

1. **Mensagens de canal com o id do canal de voz** (o "Text in Voice" do
   Discord). As rotas `/channels/:id/messages`, a sala `channel:<id>` do
   websocket e as permissões por canal já não olham o tipo do canal: o chat
   vira só UI. Prós: zero tabela, zero rota, tudo que o chat de texto tem vem
   junto, e as não lidas já contam pela sala do servidor. Contras: o histórico
   é permanente (o mesmo do canal de texto).
2. **Chat efêmero por chamada** (estilo chat de reunião: as mensagens somem
   quando a chamada acaba). Prós: nada fica guardado. Contras: precisa de
   modelo, rotas e eventos novos ligados ao ciclo da chamada (`call/service.go`,
   que é god service); não atende "persistente" nem "conectado ou não".
3. **Tabela própria `voice_messages`**. Prós: separa os dados. Contras:
   duplica repositório, handler, anexos, reações e eventos do domínio
   `message` sem ganho para o usuário.

## Decisão

Opção 1. O backend continua igual nas rotas; a única regra nova é de
permissão: as permissões de texto passam a valer no canal de voz (sem
*Enviar mensagens* caem anexar e @all, como no texto) e o editor de permissões
do canal de voz mostra o grupo "Chat do canal de voz". Não precisa *Conectar*
para ler ou escrever, como no Discord. No app, o painel é o mesmo `ChatPane`
com a sala `channel:<id do canal de voz>`, dentro da tela do canal de voz, e o
estado aberto/fechado fica num store próprio (`voiceChatPanelStore`).

## Consequências

- Fica fácil: tudo que entrar no chat de texto chega ao de voz sem esforço.
- Abrir o chat leva à tela do canal de voz (como no Discord); assim nunca há
  dois `ChatPane` visíveis ao mesmo tempo disputando a sala ativa do
  `chatStore`.
- Na tela estreita o painel vai por portal para o `body` (o `backdrop-blur` da
  tela do servidor prenderia um `fixed` dentro dela).
- Fica para depois: a busca de mensagens ainda só olha canais de texto
  (`SearchableChannels`); clicar numa notificação de mensagem do chat de voz
  abre a tela do canal sem abrir o painel.

## Fontes

- Discord, "Text Channels & Text Chat In Voice Channels":
  https://support.discord.com/hc/en-us/articles/4412085582359
- Discord, anúncio do Text in Voice:
  https://discord.com/blog/text-in-voice-chat-channel-announcement-tiv
