# 0020. Qualidade das lives: presets com piso de 720p30, controlador próprio e vídeo na placa de vídeo

- Status: aceito
- Data: 2026-10-28
- Complementa: [0015](0015-lives-em-h264.md) (a dica de conteúdo deixa de escolher a degradação)

## Contexto

Lives de produção, vistas pelo painel "Recebendo" de quem assiste:

- PC fraco, 30 fps (`detail` + `maintain-resolution`): 1080p a 5–7 fps,
  24–25 congelamentos. O encoder segurava 1080p e soltava quadros.
- PC e internet bons, 60 fps (`motion` + `maintain-framerate`): começou em
  320×180 (rampa da estimativa de banda), depois oscilou entre 1080p e 720p.
- O VPS não era o gargalo (80% de CPU livre, sem perda). Quem assiste
  decodificava por software ("FFmpeg").
- O painel "Sua transmissão" mostrava só "Ainda sem dados": não dava para
  ver o lado de quem transmite.

O dono do produto pediu qualidade de Twitch/Discord: nunca abaixo de 720p nem
com fps baixo, copiando o que os melhores fazem, e placa de vídeo para
codificar e decodificar, com AV1 nas placas que suportam.

Forças: sem backend novo, sem dependência nova, livekit-client 2.23, Electron
44 (Chromium), LiveKit v1.13 sem `enabled_codecs` (aceita AV1).

## Opções consideradas

1. **Deixar o WebRTC degradar sozinho** (`balanced`/`maintain-framerate`).
   Prós: nada a fazer. Contras: é o que gerou o 180p e a oscilação; não há
   piso de resolução no WebRTC.
2. **Presets fixos com piso e um controlador nosso** (escolhida). Como o
   Discord (720p/1080p/Fonte × 30/60) e as "renditions" da Twitch (1080p60 →
   720p60 → 720p30). O WebRTC mantém a resolução; a troca de degrau é nossa,
   com histerese.
3. **Simulcast sempre ligado** (a "rendition" de 720p sempre presente). Prós:
   quem tem internet fraca recebe 720p. Contras: dobra o encode no PC de quem
   transmite (na medição antiga, 60 → 37 fps por CPU com software).

## Decisão

**Presets e bitrates de referência** (`lib/screenShareQuality.ts`): 720p30
3 Mbps, 720p60 4,5, 1080p30 4,5, 1080p60 7 (Twitch: 6, até 8), Fonte limitada
a 1440p com 8 (30 fps) e 10 Mbps (60 fps), proporcional aos pixels entre 1080p
e 1440p. A captura usa a caixa do preset.

**Piso de resolução**: `degradationPreference: 'maintain-resolution'` sempre.
A dica de conteúdo segue o fps **escolhido** (60 = `motion`, 30 = `detail`),
também quando o controlador desce um jogo para 30 fps (o `detail` no OpenH264
liga o modo de tela, que solta quadros de jogo).

**Controlador** (`lib/screenAdaptController.ts`, puro; `lib/screenAdapt.ts`
liga ao envio): lê o `getStats()` do envio a cada 2 s. Limitado =
`qualityLimitationReason` CPU/banda, ou saindo < 70% dos quadros da fonte
(fonte ≥ 10 fps, tela parada não conta), ou banda estimada (`targetBitrate`)
< 50% do bitrate do degrau. Ignora os primeiros 10 s (rampa) e 8 s depois de
cada troca; desce depois de 3 leituras limitadas (~6 s); sobe depois de 15
folgadas (~30 s), dobrando a espera (até ~5 min) quando a subida falha em
menos de 30 s. Degraus (`lib/screenQualityLadder.ts`): 60 fps desce a
resolução antes do fps (Fonte → 1080p60 → 720p60 → 720p30); 30 fps só desce a
resolução; nunca abaixo de 720p30. A troca é ao vivo (captura + encodings, sem
despublicar). Envio pausado pelo dynacast (ninguém vendo) não conta.

**Rampa inicial**: o livekit-client já manda `x-google-start-bitrate` igual ao
teto do preset (`computeStartTargetBitrate`); o 180p vinha do
`maintain-framerate`. Com `maintain-resolution` a rampa vira poucos segundos de
fps menor, na resolução do preset. Bitrate mínimo por preset não foi
configurado: só existe por SDP munging (`x-google-min-bitrate`), frágil.

**Codec** (`lib/screenCodec.ts`, detecção em `lib/screenCodecSupport.ts`):
sempre na placa de vídeo, do melhor para o pior. Ver a emenda "Ordem de
codecs" abaixo.

**Placa de vídeo** (`main/screen/chromiumFeatures.ts`, uma chamada só de
`--enable-features`): no Chromium atual o H.264 por Media Foundation
(`MediaFoundationVideoEncodeAccelerator`) e a decodificação D3D11 já vêm
ligados no Windows; liga-se `WebRtcAV1HWEncode` (desligado só no Windows) e
`D3D12VideoEncodeAcceleratorL1T3`. No Linux, `AcceleratedVideoEncoder` e
`AcceleratedVideoDecoder` (VA-API). O Chromium ainda usa software quando o
driver está na lista de bloqueio da GPU, abaixo de 360p no encode
(`ForceSoftwareForRtcLowResolutions`), ou depois de erros do encoder; o app
registra `video_decode`/`video_encode` em `gpu.log` e o painel mostra
"Hardware · …"/"Software · …".

**Camada extra de 720p** (opcional, desmarcada; `lib/screenSimulcast.ts`):
com 1080p ou Fonte, publica também 720p30 a 3 Mbps; quem tem internet fraca
recebe 720p. Com ela o envio principal não desce de 1080p (troca o fps) e o
codec pula o AV1 (o SDK publica AV1 de tela numa camada só): H.265 ou H.264.

**Painel "Sua transmissão"**: junta o envio do codec de reserva e mostra
"Envio pausado: ninguém está vendo a live agora" quando o dynacast pausa a
camada (antes: "Ainda sem dados"), e a linha Qualidade.

## Emenda (2026-10-28): ordem de codecs, com HEVC/H.265

Decisão do dono: "o padrão dos encoders é sempre pela placa de vídeo e do
melhor para o pior: se não tem suporte para o melhor, tenta o segundo melhor".

**Ordem do Automático**: AV1 na placa → H.265 na placa → H.264 na placa →
H.264 no processador (OpenH264) → VP8. AV1 e H.265 por software nunca.
Escolher um codec em Avançado começa a ordem por ele (se a placa não codifica,
desce para o próximo; nunca sobe).

**Detecção** (`lib/screenCodecSupport.ts`, cache por sessão por tamanho/fps/
bitrate): o codec precisa estar em `RTCRtpSender.getCapabilities('video')` e
`mediaCapabilities.encodingInfo({ type: 'webrtc', … })` no tamanho da live
responder `supported` (`powerEfficient` = placa de vídeo). AV1 é perguntado com
`scalabilityMode: 'L1T3'` (o modo que o LiveKit usa em tela); H.265 e H.264 sem
modo (o SDK não usa SVC neles). Sem a API ou com erro, conta como processador.
Se uma live em AV1 ou H.265 cair no encoder por software
(`powerEfficientEncoder: false`, `libaom`/`fallback`), fica salvo no aparelho
(`salinha:screen-<codec>-software`) e as próximas pulam o codec.

**H.265 no WebRTC** (Electron 44 = Chromium 152): `WebRtcAllowH265Send` e
`WebRtcAllowH265Receive` vêm ligados por padrão (desde o Chromium 136), e
`PlatformHEVCEncoderSupport` também, mas só existe no Windows/macOS/Android:
no Linux o Chromium não codifica H.265 (decodifica, pela VA-API). O
`getCapabilities` de envio só lista H.265 quando há encoder na GPU (não há
H.265 por software no Chromium). Nenhuma feature nova em
`main/screen/chromiumFeatures.ts`.

**LiveKit**: o livekit-client 2.23 aceita `videoCodec: 'h265'` (não é SVC:
simulcast e a camada extra de 720p funcionam com ele; o AV1 continua pulado com
a camada extra). O livekit-server v1.13.10 traz `video/H265` nos
`enabled_codecs` padrão (medido: o `JoinResponse` anuncia VP8, H.264, VP9, AV1 e
H.265), então o `backend/docker-compose.yml` não muda e o LiveKit de produção
não precisa ser recriado.

**Reserva**: o SDK só aceita VP8 ou H.264 de reserva, uma por publicação. AV1 e
H.265 levam H.264 (todo mundo decodifica; VP8 se o navegador não codifica
H.264); H.264 leva VP8; VP8 nenhuma. A reserva é negociada pelo SFU por
assinante: quem não lista o codec principal na recepção faz o SFU pedir ao
publicador a reserva (`subscribedCodecs`). Com a política padrão
(`backupCodecPolicy` = regressão), a live inteira passa para a reserva enquanto
essa pessoa assiste — menos peso para quem transmite, e todo mundo vê a mesma
coisa. Decodificar H.265 no Chromium depende da placa de quem assiste.

**UI**: Avançado = Automático / AV1 / H.265 / H.264 / VP8 (Automático numa
linha, os quatro abaixo, para caber no popover da chamada a partir de 360 px).
AV1 e H.265 sem placa ficam desabilitados ("Sua placa não codifica" e a linha
"AV1 e H.265: sua placa não codifica."); H.264 só pelo processador continua
disponível. O painel "Sua transmissão"/"Recebendo" mostra o codec com onde ele
roda ("H.265 · placa de vídeo", "H.264 · processador") quando o navegador conta.

**Medido nesta máquina** (Linux, AMD Lucienne, Chromium 156 headless):
envio = VP8/H.264/AV1/VP9 (sem H.265); `encodingInfo` = AV1 e H.264 por
software, H.265 não suportado → Automático = H.264 com VP8 de reserva.
H.265/AV1 na placa só no Windows (painel: Codec "H.265 · placa de vídeo").

## Consequências

- Em vez de 180p ou 1080p a 5 fps, a live cai de degrau (no mínimo 720p30) e
  avisa quem transmite ("Qualidade reduzida para 720p 60 pela sua conexão.").
- Com a conexão do transmissor abaixo de ~3 Mbps nem 720p30 cabe: a live fica
  em 720p com fps menor, e o seletor diz "Sua conexão não está dando conta de
  720p 30."
- O 1080p60 passa de 8 para 7 Mbps; a Fonte 4K passa de até 32 para 10 Mbps
  (menos banda no VPS por espectador).
- AV1 e as features novas do Chromium só foram verificadas por código e
  testes; falta conferir no Windows com placas RTX 40/RX 7000/Arc (painel:
  Codec AV1, Codificador Hardware).
- `ScreenSender` (`lib/screenSender.ts`) concentra a minha live; o
  `CallMedia` só delega.

## Fontes

- Twitch — Broadcasting Guidelines (720p30 3 Mbps, 720p60/1080p30 4,5, 1080p60 6):
  https://help.twitch.tv/s/article/broadcasting-guidelines
- YouTube — Live encoder settings, bitrates and resolutions:
  https://support.google.com/youtube/answer/2853702
- Discord — Go Live (720p/1080p/Fonte × 15/30/60 fps):
  https://support.discord.com/hc/en-us/articles/360040816151-Go-Live-and-Screen-Share
- Chromium `media/webrtc/webrtc_features.cc` (`WebRtcAV1HWEncode`, desligado no Windows),
  `media/base/media_switches.cc` (`AcceleratedVideoEncoder`, `D3D12VideoEncodeAcceleratorL1T3`,
  `ForceSoftwareForRtcLowResolutions`), `third_party/blink/.../rtc_video_encoder.cc`
  (software abaixo de 360p), `content/renderer/render_thread_impl.cc` (GPU bloqueada desliga o vídeo).
- MDN — `MediaCapabilities.encodingInfo()` com `type: 'webrtc'`:
  https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/encodingInfo
- W3C — MediaStreamTrack Content Hints: https://www.w3.org/TR/mst-content-hint/
- Chromium `media/webrtc/webrtc_features.cc` (`WebRtcAllowH265Send`/`Receive` ligados) e
  `media/base/media_switches.cc` (`PlatformHEVCEncoderSupport`, só Windows/Apple/Android):
  https://chromium.googlesource.com/chromium/src/+/main/media/webrtc/webrtc_features.cc
- LiveKit `pkg/config/config.go` v1.13.10 (`EnabledCodecs` com H.265):
  https://github.com/livekit/livekit/blob/v1.13.10/pkg/config/config.go
- Electron 44.9.3 = Chromium 152: https://releases.electronjs.org/release/v44.9.3
- livekit-client 2.23: `backupVideoCodecs` (VP8/H.264), `BackupCodecPolicy`, `computeStartTargetBitrate`, `computeVideoEncodings`
  (`screenShareSimulcastLayers`), `LocalParticipant.publish` (L1T3 em tela com AV1/VP9).
