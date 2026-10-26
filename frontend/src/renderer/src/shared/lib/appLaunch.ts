/**
 * Depois de tentar abrir o salinha://: se até timeoutMs a página não perdeu o
 * foco nem ficou escondida, o app não abriu (sem ele instalado o navegador
 * não faz nada) e onNotOpened oferece o download. O app abrindo na frente tira
 * o foco da aba (blur) mesmo com ela ainda "visível": aí chama onOpened (se
 * houver). Devolve o cancelar (que não chama nenhum dos dois).
 */
export function watchAppLaunch(
  win: EventTarget,
  doc: EventTarget & { visibilityState: string },
  timeoutMs: number,
  onNotOpened: () => void,
  onOpened?: () => void
): () => void {
  const stop = (): void => {
    clearTimeout(timer)
    win.removeEventListener('blur', opened)
    win.removeEventListener('pagehide', opened)
    doc.removeEventListener('visibilitychange', onVisibility)
  }
  const opened = (): void => {
    stop()
    onOpened?.()
  }
  const onVisibility = (): void => {
    if (doc.visibilityState === 'hidden') opened()
  }
  const timer = setTimeout(() => {
    stop()
    onNotOpened()
  }, timeoutMs)
  win.addEventListener('blur', opened)
  win.addEventListener('pagehide', opened)
  doc.addEventListener('visibilitychange', onVisibility)
  return stop
}

/**
 * A pessoa parece estar num computador (onde o app desktop pode estar
 * instalado)? Celular e tablet ficam de fora: não existe app deles para o
 * salinha://. iPadOS se apresenta como Macintosh, mas tem tela de toque.
 */
export function looksLikeDesktop(userAgent: string, maxTouchPoints = 0): boolean {
  if (
    /Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS|BlackBerry|Opera Mini|CrOS/i.test(
      userAgent
    )
  ) {
    return false
  }
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return false
  return userAgent.trim() !== ''
}
