# 0007. Navegar no celular uma coluna por vez, com o painel decidido pela rota

- Status: aceito
- Data: 2026-10-27

## Contexto

No navegador do celular o app web desenhava a tela do desktop a 980 px (não
havia meta viewport) e, com ela, três colunas espremidas em 360 px. O app
precisa funcionar de 360 px a telas largas (docs/ai/exemplos/responsivo.md),
com toque, sem mudar o desktop (Electron) e sem engordar os god stores.

Forças: as rotas já descrevem onde a pessoa está (`/servers/:id/channels/:c`,
`/dm/:id`…); a lista da esquerda (trilho + canais/DMs) e o conteúdo são
componentes prontos; teclado virtual e safe areas variam por navegador
(Chrome no Android encolhe o layout com `interactive-widget`, o Safari do iOS
só o viewport visual).

## Opções consideradas

1. **Lista → detalhe (uma coluna por vez)**, como o Android recomenda para
   list-detail em tela compacta e como o Discord mobile faz: a lista
   (trilho + canais/DMs) é a tela principal; escolher um canal mostra o chat
   com "voltar" no cabeçalho; membros numa gaveta da direita. Prós: usa os
   mesmos componentes, só esconde colunas abaixo do `md`. Contras: precisa de
   um estado "qual coluna está na frente".
2. **Gaveta off-canvas para a lista** (o chat sempre na frente e a lista por
   cima, deslizando). Prós: menos estado. Contras: indicado para menus
   grandes e secundários; aqui a lista é a navegação principal, e a gaveta
   esconderia o que a pessoa mais usa.
3. **Rotas e páginas próprias para o celular** (`/m/...`). Prós: liberdade
   total. Contras: duplica telas e navegação; dois apps para manter.

## Decisão

Opção 1. Um store pequeno (`features/navigation/store/mobileNavStore`) guarda o
painel da frente e a gaveta de membros; funções puras em
`features/navigation/lib/mobileNav.ts` traduzem cada troca de rota no painel
(trocar de servidor mostra a lista; escolher canal/DM abre o conteúdo; o
redirecionamento para o último canal não tira a lista da frente). A casca só
aplica `max-md:hidden` na coluna de trás, então o desktop não muda. O
viewport usa `width=device-width, viewport-fit=cover,
interactive-widget=resizes-content`, a casca tem `100dvh` e, no iOS, a altura
do `visualViewport` quando o teclado abre (`--app-height`).

## Consequências

- Mais fácil: qualquer tela nova só precisa do `MobileNavButton` no cabeçalho.
- Popovers e modais viram folha de baixo/tela cheia no celular por classes
  `max-sm:`/`max-md:` (Modal, MobileSheet, menu "Mais").
- Gestos de arrastar entre painéis ficam para depois (os botões bastam).
- O "voltar" do Android segue o histórico de rotas, não o painel.

## Fontes

- Android Developers, "Build responsive navigation":
  https://developer.android.com/develop/ui/views/layout/build-responsive-navigation
- Chrome Developers, "Prepare for viewport resize behavior changes coming to
  Chrome on Android": https://developer.chrome.com/blog/viewport-resize-behavior
- HTMHell, "Control the Viewport Resize Behavior on mobile with
  interactive-widget": https://htmhell.dev/adventcalendar/2024/4/
- Ahmad Shadeed, "Virtual keyboard API": https://ishadeed.com/article/virtual-keyboard-api/
