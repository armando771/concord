import type { OverlaySnapshot } from '../renderer/src/lib/overlayState'

// Regras do overlay de jogo. Puras para poder testar.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Outra janela cobrindo um monitor (pid dono + monitor em pixels físicos), ou null. Rect tem o formato do Rectangle do Electron. */
export type Foreground = { pid: number; monitor: Rect } | null

type CallFlags = Pick<OverlaySnapshot, 'enabled' | 'inCall'> | null

/** Linha do helper → Foreground; undefined = linha que não entendemos (ignorar). */
export function parseForegroundLine(line: string): Foreground | undefined {
  const text = line.replace(/\r$/, '')
  if (text === 'none') return null
  const match = /^fullscreen (\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+)$/.exec(text)
  if (!match) return undefined
  const [pid, left, top, right, bottom] = match.slice(1).map(Number)
  if (pid <= 0 || right <= left || bottom <= top) return undefined
  return { pid, monitor: { x: left, y: top, width: right - left, height: bottom - top } }
}

/** O helper só roda no Windows, com o overlay ligado e em call. */
export function shouldWatchForeground(platform: NodeJS.Platform, snapshot: CallFlags): boolean {
  return platform === 'win32' && !!snapshot?.enabled && !!snapshot?.inCall
}

/** As janelas da Salinha pertencem ao processo main: com ela na frente, some. */
export function shouldShowOverlay(
  platform: NodeJS.Platform,
  snapshot: CallFlags,
  foreground: Foreground,
  ownPid: number
): boolean {
  return (
    shouldWatchForeground(platform, snapshot) && foreground !== null && foreground.pid !== ownPid
  )
}

/**
 * Janela do overlay: a área de trabalho inteira do monitor do jogo, em DIP.
 * A lista é uma caixa posicionada pelo CSS lá dentro (lib/overlayLayout), então
 * mover/redimensionar não mexe na janela.
 */
export function overlayBounds(workArea: Rect): Rect {
  return { x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height }
}

/** Atalho para mover/redimensionar o overlay. Ver overlayShortcuts. */
export const OVERLAY_EDIT_SHORTCUT = 'Shift+Tab'
export const OVERLAY_EXIT_SHORTCUT = 'Escape'

export interface OverlayShortcutState {
  /** Janela do overlay à vista (em call, jogo em tela cheia na frente). */
  visible: boolean
  /** Modo de edição (mover/redimensionar) ligado. */
  editing: boolean
  quitting: boolean
}

/**
 * Atalhos globais que o overlay segura agora. Só com ele à vista: Shift+Tab
 * nunca é roubado de outros apps nem da área de trabalho. Esc só no modo de
 * edição.
 */
export function overlayShortcuts(state: OverlayShortcutState): {
  toggleEdit: boolean
  exitEdit: boolean
} {
  const toggleEdit = state.visible && !state.quitting
  return { toggleEdit, exitEdit: toggleEdit && state.editing }
}
