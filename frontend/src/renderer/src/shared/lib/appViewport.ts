// Altura da casca do app no celular com o teclado virtual aberto.
//
// Chrome no Android encolhe o layout sozinho (meta viewport com
// interactive-widget=resizes-content) e o 100dvh já acompanha. O Safari do
// iOS só encolhe o viewport *visual*: sem isto, o composer fica atrás do
// teclado. Então, quando a área visível encolhe bem mais que a janela (o
// teclado), a casca passa a ter a altura dela (--app-height no <html>).

/** A partir de quantos px de diferença é teclado (e não a barra do navegador). */
const KEYBOARD_MIN = 120

/** Altura em px para a casca, ou null para deixar o 100dvh valer. */
export function appViewportHeight(v: {
  visualHeight: number
  scale: number
  innerHeight: number
}): number | null {
  // Zoom de pinça também encolhe a área visível, mas não é teclado.
  if (Math.abs(v.scale - 1) > 0.01) return null
  if (v.innerHeight - v.visualHeight < KEYBOARD_MIN) return null
  return Math.round(v.visualHeight)
}
