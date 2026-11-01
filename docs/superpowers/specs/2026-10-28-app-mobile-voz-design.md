# App mobile, fatia 5: voz (canais de voz e chamadas de DM, só áudio)

Última fatia do [roadmap](2026-10-27-app-mobile-roadmap-design.md). O kanban/Propostas saiu do app por
decisão do dono. Decisão de arquitetura e dependências: [ADR 0023](../../adr/0023-voz-no-app-mobile.md).
Divide-se em dois PRs (ver § Entrega).

## Objetivo

Falar e ouvir no celular, com o mesmo backend e a mesma sala de mídia do desktop:

- entrar e sair de **canais de voz** de um servidor;
- **ligar, atender e recusar chamadas de DM 1:1** (o backend não liga em grupo), com push quando o app está fechado;
- ver quem está na chamada e quem está falando; mudo e fone de verdade;
- continuar falando com a tela apagada ou com outro app aberto.

Sem câmera, sem transmitir ou ver tela, sem toque de telefone em tela cheia (ver § Fora de escopo).

## Decisões (com o porquê)

- **Só áudio na primeira entrega**: é o uso mais comum e o de menor risco nativo (sem
  `mediaProjection` nem câmera).
- **Porta `CallMedia` + stores pequenas** (padrão do `CallMedia` do desktop): o único arquivo que importa o
  SDK é `livekitMedia.ts`; o resto é testado no Jest com uma mídia falsa. Descartados: componentes do
  `@livekit/react-native` (amarram a tela ao SDK e não casam com os eventos `call:*` do nosso backend) e o
  fork `expo-livekit` (terceiro, pode ficar para trás do Expo SDK 58).
- **Barra de chamada + tela cheia** (como o Discord mobile): tocar no canal entra e abre a tela cheia; ao
  voltar, uma barra fixa acima do painel do usuário mantém nome do canal, mudo e sair.
- **Chamada de DM recebida**: tela de atender com o app aberto (`call:invite`); com o app fechado, push
  comum (`type=call_invite`, prioridade alta, canal Android `chamadas`) reaproveitando o FCM do
  [ADR 0022](../../adr/0022-push-direto-pelo-fcm.md). Toque de telefone em tela cheia fica para depois.
  **Mudança no backend de chamadas** (decidida com o dono): hoje `StartDM` recusa quem está offline
  (`ErrCalleeOffline`). Passa a deixar ligar para quem está offline **e tem token de push registrado** (sem
  token continua recusando), por um ponto de extensão novo e opcional (`SetOfflineRinger`, em `hooks.go`),
  usado só nessa checagem: `HandleDisconnect` segue usando `isOnline` puro, senão desconectado viraria
  fantasma na chamada. Como a chamada para offline não tem quem desligue, ganha **limite de toque de 45 s**
  (`ring_timeout.go`): sem resposta, a chamada termina (`call:ended` para quem ligou). Quem abre o app pelo
  push descobre a chamada tocando por `GET /calls/active?scope=dm&id=<conversa>`.
- **`voiceControlsStore` continua dono do mudo e do fone** (já persistidos). A chamada só reage a ele e
  informa o backend com `call:voice`. Nenhum campo novo em stores grandes.
- **Presença na mídia (ADR 0018)**: o backend tira da call quem não está na sala do LiveKit (varredura de
  20 s, 30 s de tolerância ao entrar). O app manda `call:presence {call_id}` a cada conexão do WS e quando
  muda, e `call:presence {call_id: null}` só depois de decidir que não volta à chamada (como o
  `CallPresenceBridge` do desktop).
- **Endereço do LiveKit** = origem do servidor em `ws(s)://` (o backend repassa; mesmo cálculo do
  desktop): `deriveServerUrls` ganha `liveKitUrl`.

## Arquitetura

Nova pasta `mobile/src/features/call/` (a `voice/` atual segue com mudo/fone/UserPanel). ADR:
[0023](../../adr/0023-voz-no-app-mobile.md).

| Arquivo | Responsabilidade |
|---|---|
| `lib/callMedia.ts` | Porta `CallMedia`: `connect(url, token)`, `disconnect`, `setMicEnabled`, `setDeafened`; eventos de falantes e de conexão |
| `lib/livekitMedia.ts` | Implementação com `livekit-client` (único import do SDK; fora da cobertura) |
| `api/calls.ts` | `POST /calls`, `POST /calls/:id/token`, `DELETE /calls/:id`, `GET /calls/:id/state` |
| `lib/callEvents.ts` | Eventos WS `call:*` (joined, left, voice, ended, moved, invite, ring, accept, decline, busy, error) para ações das stores |
| `lib/callPresence.ts` | Regra do `call:presence` (quando mandar a chamada e quando mandar `null`) |
| `lib/callErrors.ts` | Mapa de erro/HTTP (423 `call_locked`, sem permissão, ocupado) para o texto |
| `store/callSessionStore.ts` | Chamada atual e estado: `conectando`, `ativa`, `reconectando`, `encerrada` |
| `store/participantsStore.ts` | Participantes, mudo e fone de cada um (`call:voice`), incluindo `server_muted` e `server_deafened` |
| `store/speakingStore.ts` | Quem está falando (alta frequência: separado para não re-renderizar tudo) |
| `store/incomingCallStore.ts` | Chamada de DM tocando |
| `hooks/useCallLifecycle.ts` | Entrar, trocar, sair, ligar o microfone, enviar `call:voice` quando muda mudo/fone |
| `hooks/useCallEvents.ts` | Assina os eventos WS e reconstrói o estado por `GET /calls/:id/state` ao reconectar |
| `hooks/useCallPresence.ts` | Envia `call:presence` |
| `hooks/useCallPushTap.ts` | Toque no push de chamada: atender se ainda toca, "Chamada perdida" se não |
| `components/CallBar.tsx` | Barra fixa (canal, mudo, sair) acima do painel do usuário |
| `components/CallScreen.tsx`, `ParticipantTile.tsx` | Tela cheia, grade de participantes, falante em destaque |
| `components/IncomingCallScreen.tsx` | Atender e recusar |

Rotas: `app/(app)/chamada.tsx` e `app/(app)/chamada-recebida.tsx`. No `ChannelList`, o canal de voz passa a
entrar na chamada e lista os participantes embaixo. `useResetOnSignOut`/"Sair" desconecta a chamada antes de
apagar a sessão (mesmo padrão do push).

Backend (`internal/push`): `OnCallInvite` no `Notifier` (só destinatário offline e fora de Não perturbar),
dados `type=call_invite, call_id, conversation_id, conversation_type, name`; entrada pelo decorador do
publicador de chamadas, sem mexer em `call/service.go` (é god service: nenhum método novo nele).

Segundo plano (Android): `app.config.ts` com `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE` e
`FOREGROUND_SERVICE_MICROPHONE`; `registerGlobals()` no topo de `app/_layout.tsx`; notificação fixa "Em
chamada em {canal}" enquanto houver chamada.

## Fluxo de dados

1. Tocar no canal de voz: `POST /calls {type:"channel", channel_id}` → sessão `conectando`, tela cheia.
2. `POST /calls/:id/token` → `CallMedia.connect(liveKitUrl, token)` → microfone conforme o mudo local →
   `ativa`.
3. `call:joined`/`call:left`/`call:voice` mantêm os participantes; os falantes vêm do LiveKit.
4. Mudar mudo/fone no app → `voiceControlsStore` → hook liga/desliga o microfone e manda `call:voice`.
   Fone silencia o áudio de todos e também muda o microfone. `server_muted`/`server_deafened` (moderador)
   valem mais que o botão local, que aparece travado.
5. DM: quem liga vê "Chamando…" até `call:accept`/`call:decline`; quem recebe vê a tela de atender
   (`call:invite`) ou o push.
6. Cada conexão do WS: `call:presence {call_id}` (ou `null` depois da decisão de retomada); WS que volta
   busca `GET /calls/:id/state`.

## Erros

| Situação | Comportamento |
|---|---|
| Sala trancada (423 `call_locked`) | "Sala trancada. Peça para alguém abrir." e volta ao chat |
| Sem permissão de conectar ao canal | Aviso e não entra |
| Já em outra chamada | "Você já está em uma chamada. Trocar?"; trocar sai da antiga e entra na nova |
| Rede cai | `reconectando` (o LiveKit tenta sozinho); passou de 30 s, encerra e avisa |
| `call:ended`, `call:moved`, desconectado por moderador | Fecha a tela e mostra o motivo |
| Permissão de microfone negada | Entra mudo e sem poder falar: "Sem permissão do microfone. Você entrou mudo." + "Abrir configurações" |
| Push de chamada que já acabou | "Chamada perdida de {nome}" |

## Textos aprovados

"Entrar na chamada", "Conectando…", "Reconectando…", "Chamando…", "Sair da chamada";
"Sala trancada. Peça para alguém abrir."; "Sem permissão do microfone. Você entrou mudo." com o botão
"Abrir configurações"; "Você já está em uma chamada. Trocar?" com "Trocar" e "Cancelar"; "Chamada perdida
de {nome}"; notificação fixa "Em chamada em {canal}"; push: título "{nome}", texto "Está te ligando".

## Responsivo (360 / 768 / 1280 px)

Grade de participantes: 2 colunas em 360 px, 3 em 768 px, 4 em 1280 px (1 ou 2 pessoas: tiles grandes).
Barra respeita a área segura e o painel do usuário; alvos de toque ≥ 44 px; teclado não cobre botões;
nomes longos com reticências; rótulos de acessibilidade em "Mudo", "Fone" e "Sair".

## Testes

TDD, sem LiveKit no Jest (mídia falsa): `callEvents` (inclusive evento fora de ordem ou de outra chamada),
as 4 stores, regra mudo/fone com `server_muted`, `callPresence`, `callErrors`, `useCallLifecycle` (entrar,
trocar, sair, rede, permissão negada, sair da conta), componentes (RNTL), rotas (`renderRouter`) e, no
backend, `OnCallInvite` (só offline, respeita Não perturbar e quem já está na chamada). Bug corrigido vem
com teste de regressão. CRAP ≤ 15 em tudo que for tocado.

## Entrega (2 PRs)

- **PR A**: ADR 0023, dependências e config do plugin, porta, stores, eventos, telas, rotas e `OnCallInvite`;
  tudo testado com mídia falsa.
- **PR B**: build nativo, permissões e serviço em segundo plano, e a verificação no aparelho.

## Fora de escopo

Câmera; transmitir ou ver tela; toque de telefone em tela cheia (`ConnectionService`); soundboard;
atividades; sala trancada com pedido de entrada; visitante; escolha de dispositivo de áudio;
iOS.

## Verificação de ponta a ponta (PR B, só quando o dono pedir: sobe emulador e backend)

1. Duas contas (emulador e desktop) no mesmo canal de voz: se ouvem, o nome acende para quem fala e o
   mudo aparece dos dois lados.
2. DM: ligar, atender no desktop, recusar e perder a chamada.
3. Tela apagada por 2 minutos com a chamada continuando.
4. Rede cai e volta (modo avião).
5. App fechado na chamada: o backend tira a pessoa em ~1 min (ADR 0018).
6. Push de chamada com o app fechado (depende do projeto Firebase).

Riscos que só o aparelho resolve: tipo `microphone` do serviço em primeiro plano no manifest; áudio com
Bluetooth e interrupções (ligação, outro app); eco no alto-falante.
