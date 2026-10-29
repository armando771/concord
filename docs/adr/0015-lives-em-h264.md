# 0015. Publicar a tela (lives) em H.264, com VP8 de reserva

- Status: aceito
- Data: 2026-10-28

## Contexto

A sala publica todo vídeo em VP8 (`publishDefaults.videoCodec`). Na medição da
investigação das lives (Chromium, LiveKit v1.13.10), texto rolando em 1080p30
saiu com QP 106/127 a 3,7 Mbps em VP8 (borrado) e QP 26/51 a 0,2 Mbps em H.264
(OpenH264 com ferramentas de tela). VP9 e AV1 por software perderam fps e, no
SDK, forçam `contentHint='motion'` e SVC na tela. Forças:

- a mídia vai direto ao LiveKit, sem simulcast na tela (uma camada por live);
- Electron, Chrome, Edge, Safari e Firefox decodificam H.264, mas algumas
  builds de Chromium não codificam;
- no Windows o H.264 pode cair no encoder de hardware (Media Foundation), que
  alivia a CPU de quem joga e transmite mas não tem as ferramentas de tela do
  OpenH264;
- sem backend, sem migration e sem dependência nova; câmera fora do escopo.

## Opções consideradas

1. **H.264 só na publicação da tela, com `backupCodec` VP8** (escolhida). O
   `publishTrack` do livekit-client 2.23 aceita `videoCodec` por publicação; o
   `backupCodec: { codec: 'vp8' }` faz o SFU pedir um VP8 a quem transmite
   quando entra alguém que não decodifica H.264 (política padrão: todos caem
   para o VP8). Prós: texto nítido com pouca banda, encoder de hardware quando
   houver, sem mexer no servidor. Contras: a nitidez do hardware precisa ser
   conferida no Windows; trocar de codec exige republicar (vale na próxima live).
2. **Trocar o padrão da sala para H.264.** Prós: uma linha. Contras: muda a
   câmera junto, fora do escopo e sem medição.
3. **VP9 com SVC.** Prós: melhor compressão. Contras: por software perdeu fps
   (52 em vez de 57–60) e o SDK força `motion` na tela.
4. **Manter VP8.** Contras: texto borrado gastando 18× mais banda.

## Decisão

Opção 1. `lib/screenCodec.ts` escolhe o codec: preferência "Automático" (padrão)
e o navegador sabe codificar H.264 (`RTCRtpSender.getCapabilities`) → H.264 com
VP8 de reserva; senão, ou com "VP8" escolhido em Avançado no seletor de
qualidade (salvo no `localStorage`), VP8 sem reserva. `lib/screenPublish.ts`
publica com essas opções.

A dica de conteúdo passa a seguir o fps pedido (`screenMotion`): 60 fps (jogo)
→ `motion` + `maintain-framerate`; 30 fps (texto, apresentação) → `detail` +
`maintain-resolution`, também ao trocar a qualidade ao vivo. O teto de bitrate
fica como estava.

## Consequências

- Quem tiver problema com H.264 escolhe VP8 em Avançado; vale a partir da
  próxima transmissão.
- O painel de estatísticas da live mostra codec e `encoderImplementation`/
  `decoderImplementation` (hardware/software): é o jeito de conferir no
  Windows se o H.264 caiu no hardware e se a nitidez se manteve.
- Com o VP8 de reserva ativo, a troca de qualidade ao vivo ajusta o encoding só
  do envio principal (o SDK aplica a degradação nos dois).
- Se o hardware no Windows borrar texto, o próximo passo é escolher o codec
  pelo modo (texto → H.264 software / jogo → hardware ou VP8).

## Fontes

- livekit-client 2.23: `TrackPublishOptions.videoCodec`/`backupCodec`
  (`src/room/track/options.ts`), `LocalParticipant.publish` (codec por
  publicação e reserva), `LocalVideoTrack.setDegradationPreference`.
- LiveKit — codecs e backup codec: https://docs.livekit.io/transport/media/advanced/
- LiveKit KB — qualidade de vídeo: https://kb.livekit.io/articles/3859313029-configuring-the-client-sdk-for-optimal-video-quality
- W3C — MediaStreamTrack Content Hints: https://www.w3.org/TR/mst-content-hint/
