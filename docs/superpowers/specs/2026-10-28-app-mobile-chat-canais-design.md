# App mobile, fatia 2a: casca de navegação e chat dos canais de texto

Primeiro dos 3 PRs da fatia Chat do [roadmap](2026-10-27-app-mobile-roadmap-design.md)
(2a: esta; 2b: DMs, amigos e notificações; 2c: push). Depende do PR #313 (Fundação).
Referência de layout: o app web/desktop em coluna única
([ADR 0007](../../adr/0007-navegacao-mobile-uma-coluna.md)), nas capturas do dono.

## Objetivo

Abrir o app e ver o que o dono mostrou: trilho de servidores à esquerda, lista de
canais ao lado e o painel do usuário embaixo (com microfone, fone e engrenagem);
tocar num canal abre o chat em tela cheia (voltar no topo), onde se lê o histórico,
recebe mensagens em tempo real e envia texto.

## Decisões (com o porquê)

- **Sem barra de abas** (muda o que o roadmap dizia): lista → conteúdo, uma coluna
  por vez, como o ADR 0007 e as capturas. Perfil e sair pela engrenagem do painel.
- **Mic e fone no painel já agora**, com mudo/surdo só local (ícone riscado; fone
  mudo também silencia o mic, como no Discord). O estado fica no aparelho
  (`expo-secure-store`, já usado) e a fatia de voz só liga isso à chamada.
- **Canais de voz aparecem** na lista (seção "Canais de voz"), sem entrar: voz é a
  última fatia.
- **Texto puro nesta fatia**: anexos, figurinhas, GIFs, enquetes, reações, respostas e
  menções aparecem como o texto da mensagem ou um marcador discreto; ficam para
  depois.
- **`FlatList` invertida**, sem lib nova (FlashList só se medirmos problema).
- **Tempo real pelo WebSocket já pronto** (`onWsEvent`): sala `channel:<id>` ao abrir,
  sai ao fechar; a resposta do POST e o evento `message:create` se fundem por `id`.
- Dados do servidor em stores Zustand pequenos por responsabilidade (padrão do ADR 0021).
  Sem dependência nova.

## Arquitetura (arquivos e pastas)

```
mobile/app/(app)/
  _layout.tsx                 Stack; remove o grupo (tabs)
  index.tsx                   tela principal: trilho + lista + painel do usuário
  canal/[channelId].tsx       chat do canal (voltar no cabeçalho)
  conta.tsx                   perfil e Sair (o AccountPanel de hoje)
mobile/src/features/
  servers/
    api/servers.ts channels.ts        listServers, listChannels (porte do desktop)
    store/selectedServerStore.ts      servidor selecionado (null = DMs)
    hooks/useServers.ts               carrega servidores e canais
    lib/channelSections.ts            separa texto/voz, ordem e rótulos
    components/ServerRail.tsx ChannelList.tsx
  chat/
    api/messages.ts                   listChannelMessages(before), sendChannelMessage
    lib/messageList.ts                funde/deduplica/ordena, cursor de paginação
    lib/messageGroups.ts              agrupa por autor e janela de tempo
    hooks/useChannelMessages.ts       histórico + WS + envio
    components/MessageList.tsx MessageItem.tsx Composer.tsx ChannelHeader.tsx
  voice/
    store/voiceControlsStore.ts       muted/deafened (persistido no secure-store)
    components/VoiceControls.tsx      botões mic e fone
  profile/components/UserPanel.tsx    avatar, nome, mic, fone, engrenagem
mobile/src/shared/ui/Avatar.tsx (já planejado)
```

Estrutura por feature como o desktop; nenhum arquivo passa de 400 linhas; stores
novos e pequenos (nada de campos em god stores). Sem ADR novo: segue o 0015 e o 0007.

## Fluxo de dados

1. Boot logado: `useServers` busca `/servers` e, ao escolher um servidor,
   `/servers/:id/channels`. Ao abrir, seleciona o primeiro servidor.
2. Tocar num canal de texto: `router.push('/canal/<id>')`. `useChannelMessages`
   busca `GET /channels/:id/messages` (mais recentes) e assina `channel:<id>`.
3. Rolar até o topo: pede `before=<id da mais antiga>` (paginação por cursor, como
   no desktop) e prepende.
4. Enviar: `POST /channels/:id/messages`; ao responder, `messageList` insere a
   mensagem (se o `message:create` do WS chegar antes, não duplica).
5. `message:delete` remove da lista; troca de canal ou volta cancela a assinatura.
6. Sem rede: o campo de envio fica desativado (faixa "Sem conexão" já existente).
   Reconexão do WS refaz a busca da página mais recente para cobrir eventos perdidos.

## Erros

- Falha ao carregar: bloco com "Tentar de novo". Falha ao enviar: o texto volta ao
  campo e aparece o aviso; 403 mostra o texto de permissão.
- Canal sem permissão de leitura não aparece na lista (o backend já filtra).

## Responsivo

360 px é o alvo: uma coluna, alvos de toque ≥ 44 dp, teclado não cobre o campo de
envio (`KeyboardAvoidingView`), lista invertida mantém a posição ao abrir o teclado.
A 768 px o conteúdo fica com largura máxima e centralizado (layout de duas colunas
fica para depois).

## Textos (para aprovação do dono)

Reaproveitados do desktop quando existem (ex.: "Canais de texto", "Canais de voz",
"Mensagem para #canal"). **Novos, a aprovar:**

- Painel de DMs (até a fatia 2b): "Mensagens diretas: em breve"
- Canal de voz tocado: "Canais de voz chegam em breve"
- Lista de mensagens vazia: "Ainda não há mensagens aqui."
- Carregando: "Carregando mensagens…"; falha: "Não foi possível carregar as mensagens."
  + botão "Tentar de novo"
- Sem permissão para enviar: "Você não tem permissão para enviar mensagens neste canal."
- Falha ao enviar: "Não foi possível enviar. Tente de novo."
- Marcador de conteúdo não suportado: "Anexo (ainda não aparece no app)"
- Acessibilidade dos botões: "Silenciar microfone" / "Ativar microfone",
  "Ensurdecer" / "Desensurdecer", "Configurações"

## Testes (TDD, só o que importa)

- `messageList`: funde, deduplica por id, ordena, cursor, remove por delete.
- `messageGroups`: agrupa por autor/tempo; quebra em mudança de dia.
- `channelSections`: separa texto/voz, mantém a ordem do servidor.
- `voiceControlsStore`: fone mudo implica mic mudo; restaura do secure-store.
- `useChannelMessages`: assina/desassina a sala, funde WS com o POST, reconexão refaz a busca.
- Componentes: `ChannelList` (toque abre o canal; voz não abre), `Composer` (desativado
  offline/enviando, devolve o texto na falha), `VoiceControls` (alterna e anuncia o estado),
  `UserPanel`.
- Roteamento (`renderRouter`): "/" mostra o trilho e a lista; `/canal/<id>` mostra o chat.
- CRAP ≤ 15 nas funções tocadas.

## Fora de escopo

DMs, amigos, notificações e push (2b e 2c); anexos, figurinhas, GIFs, enquetes,
reações, respostas, menções, fixadas, busca e lista de membros; entrar em canal de
voz; criar/editar servidor ou canal; layout de duas colunas em tablet.

## Verificação de ponta a ponta

1. `node scripts/affected-tests.mjs pr` verde.
2. Backend local + 2 contas (o app e o app web): mensagem enviada de um lado aparece
   no outro em tempo real; histórico longo pagina ao rolar; enviar offline fica
   desativado; derrubar e subir o backend reconecta e não perde a mensagem.
3. Emulador a 360 px e 768 px: sem corte, teclado não cobre o campo.
4. Mic e fone alternam, mantêm o estado ao reabrir o app e o fone mudo silencia o mic.
