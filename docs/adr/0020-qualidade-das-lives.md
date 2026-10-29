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

**Camada extra de 720p** (opcional; `lib/screenSimulcast.ts`; Automático na emenda abaixo):
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
(Substituído na emenda de 2026-10-29: política SIMULCAST e reserva em 720p30.)

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

## Emenda (2026-10-28): camada de 720p automática e microfone a 64 kbps

Decisão do dono.

**Camada extra de 720p** (`lib/screenSimulcast.ts`, `chooseScreenSimulcast`):
três modos, **Automático** (padrão), **Ligada** e **Desligada**, salvos em
`salinha:screen-share-720p-extra` (`'1'` = ligada, `'0'` = desligada, ausente ou
outro valor = Automático; quem já tinha marcado/desmarcado a caixa antiga mantém
a escolha). A UI são três botões ao lado dos de resolução e fps, no mesmo estilo
(mais simples e coerente que caixa de marcar com três estados; texto de apoio:
"Automático liga quando a sua placa de vídeo aguenta").

- Ligada/Desligada valem sempre (a camada só existe com captura acima de 720p).
- Automático liga quando o codec que a ordem de codecs escolheria sai pela
  placa de vídeo (`powerEfficient`) **e** a live é 1080p ou Fonte; pelo
  processador, fica desligada.
- **AV1 na placa**: o Automático mantém o AV1 e **não** liga a camada (o SDK
  publica AV1 de tela numa camada só). O AV1 é o melhor codec da placa; quem
  quiser a camada de 720p escolhe Ligada (e perde o AV1) ou H.265/H.264 em
  Avançado.
- **Queda para o software**: a marca por aparelho
  (`salinha:screen-<codec>-software`) agora também é gravada para H.264 quando
  o `getStats()` da live mostra `powerEfficientEncoder: false` (só pela flag,
  não pelo nome do encoder). Na próxima live o H.264 conta como processador e o
  Automático desliga a camada. Ligada força mesmo assim. Não há botão para
  limpar a marca (como já era para AV1/H.265).

**Microfone a 64 kbps** (`lib/micPublisher.ts`): `audioPreset: { maxBitrate:
64_000 }` (mono, como o Discord; o padrão do SDK é ~32 kbps; o preset
`musicHighQuality` é 96 kbps, por isso o valor explícito). DTX e RED continuam
os da sala. Vale na publicação e na republicação (o `MicPublisher` publica
clones); trocar o dispositivo mantém o mesmo sender e a mesma codificação.

## Emenda (2026-10-29): rótulo do codec, reserva leve, Linux com NVIDIA e congelamentos

Dados de produção (mesma live, Windows, ao mesmo tempo): amigos no Windows
recebiam H.265 1080p a 23–27 fps (decodificador na placa, perda 0%, 11–30
congelamentos); o dono, no Linux com RTX 3070, recebia "H.264 · processador"
1080p a **8 fps**.

**Rótulo enganoso**: na aba "Recebendo", o "· placa de vídeo/processador" da
linha Codec vinha do **decodificador** de quem assiste (FFmpeg no Linux), não do
codificador de quem transmite. Agora quem transmite responde, por **RPC do
LiveKit** (`salinha.screen-encoder`, `lib/screenEncoderRpc.ts`), o resumo do
próprio envio (`lib/screenEncoderInfo.ts`): por codec ativo, placa ou
processador, altura e fps saindo, se é a reserva, e o degrau do principal. Quem
assiste pergunta só com o painel aberto, no máximo a cada 5 s, sem esperar a
resposta para mostrar o resto, e mostra "Codificado: Na placa de vídeo / No
processador" e "Saindo em: 1080p 30" (ou "720p 30 (reserva)" quando recebe a
reserva). A linha Decodificador continua sendo a local. Versão antiga do outro
lado (sem o método): "—". A "Sua transmissão" ganhou a linha "Reserva".
Opções: atributos do participante (exigem `canUpdateOwnMetadata` no token, que
também deixa o cliente trocar o próprio nome e metadados: mudança de backend e
de segurança); mensagem de dados periódica para a sala (banda para quem nem
abriu o painel, e quem entra depois espera a próxima). O RPC não precisa de
backend nem de permissão nova (`canPublishData` já vem ligado).

**Reserva H.264 (causa do 8 fps)**, lida no livekit-client 2.23
(`publishAdditionalCodecForTrack`, `computeTrackBackupEncodings`): o SDK só
codifica a reserva quando o SFU pede (um assinante não lista o codec
principal), num sender próprio sobre um **clone** da captura, e para tela usa o
`screenShareEncoding` inteiro da live (o `encoding` do `backupCodec` é ignorado
em tela): 1080p, mesmo fps e mesmo bitrate (4,5–7 Mbps), fora do controlador de
qualidade e com a dica de conteúdo do momento do clone. O codificador (placa ou
OpenH264) é o que o Chromium escolher para o H.264; não há API para forçar.
Com a política padrão (`PREFER_REGRESSION`, "não garantida") o SFU às vezes
regride todo mundo para a reserva (medido aqui) e às vezes manda os dois codecs
(o que aconteceu em produção): dois encoders de 1080p no PC de quem transmite e
~12 Mbps de envio. Decisão (`lib/screenBackup.ts`):

- `backupCodecPolicy: SIMULCAST` explícito: quem decodifica o principal fica
  nele; só quem não decodifica recebe a reserva.
- Assim que o SDK cria o sender da reserva (`setSimulcastTrackSender`), o
  encoding vira **720p30 a 2,5 Mbps** (lado menor da captura, nunca amplia),
  `priority`/`networkPriority: 'low'` (a banda estimada vai primeiro para o
  principal) e o clone segue a dica de conteúdo da live (também quando o
  controlador troca de degrau). `maintain-resolution` o SDK já aplica.
- O controlador lê **só o envio principal**: a reserva já está no piso
  (720p30) e, lida junto, faria o principal descer à toa.
- Codec da reserva: H.264 (todo navegador decodifica; na placa quando a placa
  codifica H.264 — quem tem H.265/AV1 na placa quase sempre tem); VP8 só sem
  H.264. Recusado o encoding, a reserva segue como o SDK criou e a live continua.

Medido nesta máquina (LiveKit 1.13.10 local, Chromium 156 headless, H.264
principal + VP8 de reserva, 1080p30, um assinante sem H.264 por SDP): sem
reserva, principal 29 fps a 3,4 Mbps; política padrão = todos regredidos para a
reserva em 1080p a 4,5 Mbps; SIMULCAST com a reserva antiga = reserva 1920×1080
a 3,2 Mbps e o principal a 20 fps (CPU); com a reserva ajustada = reserva
1280×720 a 2,25 Mbps (o principal seguiu em 20 fps nesta máquina, com três
navegadores e dois encoders por software no mesmo notebook; no Windows a
reserva H.264 vai para a placa). O RPC respondeu o codificador nos dois
assinantes.

**Linux: decodificar na placa e o Linux nem pedir a reserva.** O Electron 44 no
Linux decodifica H.265 pela VA-API quando o driver existe (medido aqui, AMD
Lucienne/Mesa: `RTCRtpReceiver` lista H.265 e `decodingInfo` = suportado na
placa), e então o SFU nem pede a reserva. A NVIDIA não tem VA-API próprio: só
pelo **nvidia-vaapi-driver** (`nvidia_drv_video.so`, só decodifica), e o
Chromium recusa VA-API em NVIDIA sem `VaapiOnNvidiaGPUs` (desligada, "para
desenvolvedores testarem"; a doc do Chromium avisa que os drivers VA-API da
NVIDIA não são suportados, crbug.com/1492880) e sem `VaapiIgnoreDriverChecks`.
Por isso no Linux do dono não havia H.265 na recepção, veio a reserva H.264, e
ela decodificava por FFmpeg. Decisão (`main/screen/linuxGpu.ts`,
`chromiumFeatures.ts`):

- A placa é lida do sysfs (`/sys/bus/pci/devices/*/{class,vendor}`) no boot: o
  `app.getGPUInfo` só responde depois do `ready`, tarde para o
  `--enable-features`.
- Só NVIDIA (híbrido Intel/AMD + NVIDIA não conta: a outra placa já tem VA-API)
  **e** o driver instalado (`/usr/lib/dri`, `/usr/lib64/dri`,
  `/usr/lib/<arch>-linux-gnu/dri`, `LIBVA_DRIVERS_PATH`): entram
  `VaapiOnNvidiaGPUs`, `VaapiIgnoreDriverChecks` e `AcceleratedVideoDecodeLinuxGL`
  na mesma chamada de `--enable-features` (nomes conferidos no binário do
  Electron 44.9.3) e `LIBVA_DRIVER_NAME=nvidia` (exigido pelo libva 2.20+; não
  sobrescreve o da pessoa). `--ignore-gpu-blocklist` não: liberaria tudo o que a
  lista de bloqueio desliga.
- Sem o driver: `gpu.log` registra `nvidia=sim nvidia_vaapi_driver=nao (Instale
  o nvidia-vaapi-driver para usar a placa de vídeo)` e o painel "Recebendo",
  quando decodifica por software, mostra a mesma frase no pé.
- Se mesmo com o driver o Chromium cair no software, o painel mostra
  "Software · FFmpeg" e o `gpu.log` o `video_decode`: falta testar no PC do dono.

**Codificar na NVIDIA no Linux: não dá com o Chromium.** O nvidia-vaapi-driver
não codifica, o Chromium não usa NVENC no Linux (só VA-API) e não codifica H.265
no Linux em placa nenhuma (`PlatformHEVCEncoderSupport` só Windows/macOS/
Android). Proposta para o dono decidir (não implementada): live pelo helper em
Rust (`native/`) com o SDK Rust do LiveKit (`livekit`/`webrtc-sys`, libwebrtc
própria com NVENC H.264/H.265 no Linux, `LIVEKIT_PREFERRED_HW_ENCODER`),
captura pelo portal ScreenCast/PipeWire, entrando na sala como um participante
"tela" da pessoa (token próprio no backend, `canPublishSources` só tela) e o app
mostrando esse participante como a live dela; fallback = a live atual pelo
Chromium. É grande: token e identidade novos, captura PipeWire em Rust, áudio
da tela, controlador e painel para o helper, empacotamento da libwebrtc.

**Congelamentos com H.265 na placa (Windows, perda 0%, jitter baixo).** Sem
Windows aqui, causas plausíveis do nosso lado, por ordem: (1) a reserva em 1080p
dividindo envio e placa/CPU com o principal (corrigido acima: o principal
saía a 23–27 de 30 fps); (2) troca de camada no SFU com a camada extra de 720p
(cada troca espera um quadro-chave); (3) quadros-chave grandes pedidos por PLI;
(4) troca de degrau do controlador (já com histerese de 6 s/30 s e espera
dobrando). Instrumentação nova nos dois painéis para medir em produção:
"Quadros-chave/PLI" (quadros-chave codificados/decodificados e pedidos PLI+FIR:
quadro-chave muito acima dos pedidos = o encoder gerando sozinho, p. ex.
detecção de troca de cena do OpenH264, vista aqui com conteúdo sintético),
"NACK", "Fora de ordem" (`packetsDiscarded`: chegaram cedo ou tarde demais para
o buffer) e "Buffer" (espera média no buffer de jitter). Nada mais foi mudado
sem evidência (intervalo de quadro-chave, `jitterBufferTarget`).

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
  (`screenShareSimulcastLayers`), `LocalParticipant.publish` (L1T3 em tela com AV1/VP9),
  `publishAdditionalCodecForTrack`/`computeTrackBackupEncodings` (reserva com o `screenShareEncoding`), `Room.registerRpcMethod`.
- Chromium `docs/gpu/vaapi.md` (`VaapiOnNvidiaGPUs`, `VaapiIgnoreDriverChecks`, `AcceleratedVideoDecodeLinuxGL`,
  crbug.com/1492880): https://chromium.googlesource.com/chromium/src.git/+show/lkgr/docs/gpu/vaapi.md
- nvidia-vaapi-driver (só decodifica; `LIBVA_DRIVER_NAME=nvidia` no libva 2.20+): https://github.com/elFarto/nvidia-vaapi-driver
- LiveKit Rust SDK, encoders por hardware (NVENC no Linux): https://docs.livekit.io/robotics/media/video/encoders/ e
  https://lib.rs/crates/livekit-webrtc
