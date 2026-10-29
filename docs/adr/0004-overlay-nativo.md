# 0004. Desenhar o overlay de jogo numa janela nativa do helper no Windows

- Status: aceito
- Data: 2026-10-26

## Contexto

Usuários relatam queda de FPS nos jogos com a Salinha aberta no Windows. O
overlay de jogo era uma `BrowserWindow` transparente, click-through e sempre no
topo: por cima do jogo fica uma janela Chromium com composição própria no DWM
(swap chain do Chromium), mais um processo de renderer vivo durante toda a call.
O PR #266 já encolheu a janela para o tamanho da lista e cortou repaints, mas o
custo de ter o Chromium compondo por cima do jogo continua.

Forças: o overlay precisa continuar igual para o usuário (lista, avatares com
GIF, quem fala, mudo/surdo, tema, opacidade, posição/escala editáveis com
Shift+Tab); o Linux/macOS continuam com a janela do Electron; sem dependência
nova; o que der para testar no Linux (o CI e o dev rodam lá) tem que ser puro.

## Opções consideradas

1. **Janela Win32 em camada no helper Rust (`concord-audio.exe overlay`)**, com
   Direct2D (software) + DirectWrite + WIC e `UpdateLayeredWindow` com alfa por
   pixel. Estado em JSON por linha no stdin. Prós: nenhum Chromium por cima do
   jogo; redesenha só quando o estado muda (ou um GIF de quem fala troca de
   quadro), o resto do tempo a thread fica parada no `GetMessage`; usa a crate
   `windows` que o helper já tem. Contras: refazer o desenho (pílulas, texto,
   ícones, GIF) em código nativo e manter os dois em paridade.
2. **DirectComposition + Direct3D/DXGI no helper**. Prós: composição pela GPU,
   bom para animação contínua. Contras: um dispositivo D3D e uma swap chain
   vivos ao lado do jogo (justamente o tipo de custo que queremos tirar) para
   uma lista que quase nunca muda; mais código.
3. **Continuar no Electron e otimizar mais** (offscreen rendering, `paint`
   manual). Prós: um código só. Contras: o processo de GPU/renderer e a janela
   do Chromium continuam; o ganho que sobrou é pequeno depois do #266.
4. **Injeção no jogo (hook de Present, como o overlay do Discord)**. Prós:
   custo mínimo de composição. Contras: anticheats bloqueiam/banem, código
   frágil por API gráfica; fora de questão.

## Decisão

Opção 1. O helper ganha o modo `overlay` (mesmo exe, já empacotado; nada muda no
electron-builder). A janela tem `WS_EX_LAYERED | WS_EX_TRANSPARENT |
WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW`, é DPI-aware por monitor e
fica fora da captura de tela (`WDA_EXCLUDEFROMCAPTURE`). O Direct2D roda em
software: a lista é pequena e redesenhada raramente, então não vale um
dispositivo na GPU. O Electron baixa os avatares e manda o caminho do arquivo
(o Rust não precisa de HTTP). Se o helper não existir, não disser `ready` em 5 s
ou sair, o main cai na janela do Electron até reabrir o app; `--overlay=electron`
ou `SALINHA_OVERLAY=electron` força a antiga para comparar.

Dependências: só features novas da crate `windows` 0.62 (Direct2D, DirectWrite,
Imaging, Dxgi_Common, Com, Variant, LibraryLoader, KeyboardAndMouse) e
`windows-numerics` 0.3 como dependência direta: é do mesmo projeto windows-rs,
já vinha no `Cargo.lock` como dependência da `windows`, e é onde ficam os
`Matrix3x2`/`Vector2` que as APIs do Direct2D pedem. O JSON do protocolo é lido
por um parser mínimo próprio (`src/overlay/json.rs`), em vez de serde.

## Consequências

- O protocolo (docs/overlay-nativo.md) é contrato entre dois códigos: mudança
  em um lado pede teste dos dois (`nativeOverlayProtocol.test.ts` e
  `cargo test`).
- Paridade visual é manual: a geometria do CSS está copiada em
  `src/overlay/layout.rs` (constantes `css::*`). Mexeu no `OverlayApp.tsx`,
  confira o nativo.
- A fonte é a Segoe UI (a Outfit do app vem empacotada só no renderer); a
  transição de 150 ms da opacidade de quem fala não existe no nativo.
- Fica para depois: medir no Windows com o roteiro de docs/overlay-nativo.md;
  se o ganho se confirmar, tirar a janela do Electron do Windows de vez.

## Fontes

- Microsoft, "Layered Windows" / `UpdateLayeredWindow`:
  https://learn.microsoft.com/windows/win32/winmsg/window-features#layered-windows
- Microsoft, "Direct2D and GDI Interoperability" (`ID2D1DCRenderTarget`):
  https://learn.microsoft.com/windows/win32/direct2d/direct2d-and-gdi-interoperation-overview
- Microsoft, "DirectComposition": https://learn.microsoft.com/windows/win32/directcomp/directcomposition-portal
- Microsoft, "GIF Format Overview" (metadados `/grctlext`, `/imgdesc` no WIC):
  https://learn.microsoft.com/windows/win32/wic/-wic-native-image-format-metadata-queries
- Microsoft, `SetWindowDisplayAffinity`:
  https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity
