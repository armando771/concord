/**
 * Depois de tentar abrir o salinha://: se até timeoutMs a página não perdeu o
 * foco nem ficou escondida, o app não abriu (sem ele instalado o navegador
 * não faz nada) e onNotOpened oferece o download. O app abrindo na frente tira
 * o foco da aba (blur) mesmo com ela ainda "visível". Devolve o cancelar.
 */
export function watchAppLaunch(
  win: EventTarget,
  doc: EventTarget & { visibilityState: string },
  timeoutMs: number,
  onNotOpened: () => void
): () => void {
  const stop = (): void => {
    clearTimeout(timer)
    win.removeEventListener('blur', stop)
    win.removeEventListener('pagehide', stop)
    doc.removeEventListener('visibilitychange', onVisibility)
  }
  const onVisibility = (): void => {
    if (doc.visibilityState === 'hidden') stop()
  }
  const timer = setTimeout(() => {
    stop()
    onNotOpened()
  }, timeoutMs)
  win.addEventListener('blur', stop)
  win.addEventListener('pagehide', stop)
  doc.addEventListener('visibilitychange', onVisibility)
  return stop
}
