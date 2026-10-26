# Vídeo estilo Discord: fundo da câmera, menu "Vídeo" e dispositivos na chamada

Issue #225 (proposta da comunidade) e o retorno sobre o chroma key do #226.

## Por quê

O chroma key do #226 só removia uma cor: precisava de pano verde/azul, sem ele
deixava um véu roxo por cima do rosto, ficava no fim de "Voz e áudio" e a
prévia só aparecia depois de ligar o efeito. O dock da chamada também não
trocava microfone, saída nem câmera, e não existia escolha de câmera.

## O que o usuário tem

- **Configurações → Vídeo** (menu novo, depois de "Voz e áudio"): câmera, prévia
  ao vivo ("Testar vídeo"; a câmera só abre ao pedir), "Sempre ver prévia do
  vídeo" e **Fundo do vídeo**: Nenhum, Borrar, Personalizado (imagem ou **GIF
  animado**) e 8 imagens do app. Mudar vale na hora.
- **Mudar fundo de vídeo** (modal, como no Discord): prévia no topo, mesmos
  fundos, checkbox e "Alterar plano de fundo". É um rascunho: só vale ao confirmar.
- **Dock da chamada**: mic, fone e câmera têm uma setinha no canto que abre o
  menu de dispositivos (o da câmera também abre o modal e as configurações).
- **Sempre ver prévia do vídeo**: ligar a câmera numa chamada abre a prévia
  ("Ligar câmera" / "Mudar fundo de vídeo") antes de transmitir.
- Sem pano e sem chroma key: o código e a tela do #226 saíram.

## Como funciona

- **Segmentação no aparelho**: MediaPipe `ImageSegmenter` com o
  `selfie_segmenter.tflite` (250 KB, Apache-2.0). O vídeo não sai da máquina.
  `personSegmenter.ts` é importado por `import()`: o WASM (~13,5 MB, ~4 MB
  comprimido) só é baixado quando alguém liga um efeito. No instalador ele
  entra como asset.
- **`file://` funciona**: o app empacotado carrega o `.wasm` por `fetch` do
  próprio pacote, que a CSP já libera por `'self'` no `connect-src` (verificado
  no Electron). O loader entra como `?url` e o modelo como `?inline`
  (`modelAssetBuffer`).
- **Pipeline** (`lib/backgroundPipeline.ts`): a câmera passa por um canvas; a
  track publicada no LiveKit é a do `canvas.captureStream(30)`, então a prévia
  local e os outros usuários veem o mesmo vídeo. Composição no canvas 2D (GPU):
  fundo (vídeo desfocado ou imagem cover) + quadro recortado pela máscara
  (`destination-in`). Sem laço por pixel em resolução cheia.
- **Qualidade da borda**: máscara 256x256 → média móvel entre quadros
  (`smoothMask`) → erosão de 1 px (`erodeMask`, tira o contorno do fundo
  original) → curva suave (`confidenceToAlpha`) → leve desfoque ao aplicar.
- **Desempenho**: processa em até ~960x540 (`PROCESS_MAX_PIXELS`); se um quadro
  passa de 26 ms, segmenta um quadro sim, um não. Medido: ~8 ms por segmentação
  na CPU; ~27 fps de saída no Chromium e no Electron (em headless).
- **Nunca vaza o fundo**: enquanto o modelo carrega, o quadro inteiro sai
  desfocado. Se o modelo não carregar, volta para a câmera crua com aviso e só
  tenta de novo quando o usuário escolher outro fundo.
- **Trocas ao vivo sem piscar** (`CallMedia.replaceCamera`, via `replaceTrack`):
  ligar/desligar o efeito e trocar de câmera mantêm SID e espectadores. Trocar
  de desfoque para imagem não troca nada (o pipeline lê o fundo a cada quadro).
  As trocas passam por uma fila e esperam a publicação da câmera terminar.
- **Câmera escolhida**: `getCameraStream(deviceId)` pede `{ exact }` e, se a
  câmera sumiu (`OverconstrainedError`), abre a padrão. O `devicechange` volta
  para a padrão com aviso, como no microfone.

## GIF de fundo

- `Personalizado` aceita GIF (até 10 MB). O arquivo vai inteiro para o
  **IndexedDB** (`lib/gifStorage.ts`): é grande demais para o localStorage e
  reduzir quebraria a animação. O localStorage guarda só o registro; o blob: é da
  sessão e `hydrateGifs()` o recria ao abrir o app (GIF que sumiu do banco sai da
  lista).
- O `<img>` só anima enquanto a página é pintada, o que não vale para um canvas
  que alimenta uma chamada. Por isso `lib/gifFrames.ts` decodifica os quadros uma
  vez com `ImageDecoder` (WebCodecs) e o pipeline escolhe o quadro pelo relógio;
  quadros e memória são limitados (160 MB). Sem `ImageDecoder` cai para o `<img>`.
- Imagem de fundo solta ao trocar, ao sair do modo imagem e ao encerrar.

## Dados

- `store/videoSettingsStore.ts` (`concord-video`): `cameraId`,
  `alwaysPreview`, fundo e até 5 imagens do usuário (JPEG ≤ 960x540, data URL).
  Valida o que lê do disco, e quota cheia não quebra o ajuste. A chave antiga
  `concord-chroma-key` é apagada.
- As imagens do app são 8 SVGs originais (`assets/video-backgrounds`), gerados
  no repo, importados como data URL: imagem de `file://` contaminaria o canvas
  e quebraria o `captureStream`.

## Testes

- Unitários: `videoBackground`, `gifFrames`, `segmentation` (máscara, erosão, cover),
  `backgroundPipeline` (ordem das operações no canvas, vazamento, falhas, lento,
  `setSource`/`detach`/`destroy`), `videoSettingsStore`, `rtc`, `livekit`,
  `callStore` (efeito ao vivo, troca de câmera, falhas, prévia), componentes e
  menu de navegação.
- `scripts/e2e-video-background.mjs`: MediaPipe de verdade sobre uma foto de
  pessoas, no Chromium e (`--electron`) no Electron em `file://` com a CSP do
  app. Confere desfoque, troca de fundo, GIF animando, IndexedDB, volta para
  "nenhum", FPS e ausência de erros de CSP. `SHOTS=pasta` salva prints para olhar a borda.

## Fora do escopo

Fundo em vídeo/GIF, chroma key/pano de qualquer cor, outros efeitos além de
desfoque e imagem, transparência real (o vídeo de WebRTC não tem canal alfa).
