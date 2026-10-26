import type { WindowState } from '../../shared/perfLog'

interface WindowLike {
  isDestroyed(): boolean
  isMinimized(): boolean
  isVisible(): boolean
}

/** Minimizada é checada antes de visível: no Windows a minimizada não conta como visível. */
export function windowState(win: WindowLike | null): WindowState {
  if (!win || win.isDestroyed()) return 'tray'
  if (win.isMinimized()) return 'minimized'
  return win.isVisible() ? 'visible' : 'tray'
}
