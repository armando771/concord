import type { WindowState } from '../../shared/perfLog'

interface WindowLike {
  isDestroyed(): boolean
  isMinimized(): boolean
  isVisible(): boolean
}

interface ShowHideEmitter {
  on(event: 'show', listener: () => void): unknown
  on(event: 'hide', listener: () => void): unknown
}

/**
 * Acompanha se a janela está oculta (bandeja) pelos eventos show/hide. Só os eventos
 * distinguem "minimizada" de "minimizada e depois oculta": no Windows as duas têm
 * isMinimized() true e isVisible() false. Começa oculta: o app cria a janela com show:false.
 */
export function trackHidden(win: ShowHideEmitter): () => boolean {
  let hidden = true
  win.on('show', () => {
    hidden = false
  })
  win.on('hide', () => {
    hidden = true
  })
  return () => hidden
}

export function windowState(win: WindowLike | null, hidden: boolean): WindowState {
  if (!win || win.isDestroyed() || hidden) return 'tray'
  if (win.isMinimized()) return 'minimized'
  return win.isVisible() ? 'visible' : 'tray'
}
