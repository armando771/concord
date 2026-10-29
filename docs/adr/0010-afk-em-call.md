# 0010. Detectar AFK em call pelo aviso de fala do app, com o AFK filtrando as fotos das calls

- Status: aceito
- Data: 2026-10-27

## Contexto

O tempo em call (XP de voz do nível e os badges Voz, Coruja, Madrugador,
Maratona, Streamer, Espectador, Câmera ligada e Festeiro) era farmado deixando
o app aberto numa call sem ninguém falar. O pedido: 10 minutos sem falar e para
de contar; voltou a falar, conta na hora. "Falar" é a voz ativa do microfone da
pessoa. O Festeiro também passa a contar só contas reais (e-mail confirmado e
sem prazo de idade; eram 7 dias até a migration 000165 e 24 horas até a 000170).

Forças: o servidor não vê a mídia (ela vai direto para o LiveKit); o XP e os
badges já leem as calls a cada 10 s por duas interfaces pequenas
(`level.VoiceSource`, `badge.CallSource`); `call/service.go` é um god service e
não pode ganhar métodos.

## Opções consideradas

1. **Webhook do LiveKit.** Os webhooks só têm entrada/saída de sala,
   participante e track, egress e ingress: não há evento de fala. Descartada.
2. **Participante oculto do servidor em cada sala** (server-sdk-go com
   `ConnectToRoom`) para ouvir os `ActiveSpeakersChanged`. Prós: a fala vem do
   próprio LiveKit, sem confiar no app. Contras: uma conexão WebRTC do backend
   por sala ativa, ciclo de vida de bot, um participante a esconder em todo o
   app. Caro demais para o problema.
3. **O app avisa pelo WebSocket** (`call:speaking`, `{call_id}`) enquanto a
   pessoa fala, e o servidor guarda a última fala. Prós: barato (um aviso a cada
   15 s de quem fala), o app já sabe quem está falando (o anel verde). Contras:
   confia no app; um script poderia mandar o aviso (assim como poderia tocar
   áudio no microfone).

## Decisão

Opção 3. O app manda `call:speaking` quando começa a falar e a cada 15 s
falando (`features/call/lib/speechReport*.ts`), usando o mesmo `speakingIds`
do anel verde (para mim: a detecção local no microfone publicado, ou o
`ActiveSpeakers` do LiveKit se ela não carregar; mutado nunca conta). O
servidor (`internal/call/afk.go`) aceita só de quem está naquela call e no
máximo um aviso a cada 10 s por pessoa. O `call.AFK` embrulha o `call.Service`
e é ele que o XP e os badges leem: some de `ActiveVoiceUsers` (XP e buff da
call) e de `Voice`, `ScreenSharers` e `ScreenWatchers` quem está há 10 min sem
falar, contados da última fala, da entrada na call ou do boot do servidor (o
mais recente), e essas pessoas vão em `CallSnapshot.Away` para a Câmera e o
Festeiro. O roteamento do WS ganha só o tipo novo; o `SpeakingRouter` desvia
`call:speaking` para o AFK sem tocar no `service.go`.

## Consequências

- App antigo (sem o aviso): conta os primeiros 10 min de cada entrada na call
  e depois para, como quem não fala. Decidido assim porque senão o app antigo
  seria o jeito de burlar; a versão nova chega pela atualização automática.
- Sem exceções: quem só transmite tela ou só assiste a uma live sem falar
  também para em 10 min, como o pedido. Mutado já não contava para voz/XP e
  segue assim; a Maratona quebra com o AFK, como já quebrava com o mute.
- Deploy: a última fala fica só na memória; depois de um reinício todo mundo
  ganha 10 min de folga a partir do boot.
- Vale daqui para frente: não há histórico de fala para descontar tempo já
  contado. O pico do Festeiro gravado é um máximo sem histórico de quem estava
  na call, então também não dá para recalcular.
- Conta real do Festeiro: consulta só de quem está em call com mais alguém
  ouvindo, com cache de 10 min por pessoa (`badge/real_accounts.go`).
- O app ainda não mostra "XP pausado" por AFK (só por mute); texto novo de UI
  precisa de aprovação.

## Fontes

- Webhooks do LiveKit (lista de eventos): https://docs.livekit.io/home/server/webhooks/
- Active speakers no cliente (vêm do servidor, inclusive o local): https://docs.livekit.io/home/client/tracks/subscribe/
