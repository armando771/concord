import type { OverlaySnapshot } from '../../renderer/src/features/overlay/lib/overlayState'
import {
  placeOverlayBox,
  type OverlayFrame,
  type OverlayLayout,
  type OverlaySize
} from '../../renderer/src/features/overlay/lib/overlayLayout'

export type { OverlayFrame }

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

/** Folga em volta da caixa da lista na janela do overlay (anel de quem fala, sombra). */
export const OVERLAY_WINDOW_MARGIN = 8

/**
 * Janela do overlay, em DIP. Fora da edição, só a caixa da lista (no mesmo
 * lugar que o CSS da página calcula, a partir das mesmas frações) com uma
 * margem, cortada na área de trabalho: uma janela transparente pequena por cima
 * do jogo custa menos para o compositor. Editando (ou com a caixa ainda sem
 * medida), a área de trabalho inteira, para arrastar a qualquer lugar.
 */
export function overlayWindowRect(
  workArea: Rect,
  layout: OverlayLayout,
  box: OverlaySize | null,
  editing: boolean
): Rect {
  if (editing || !box || box.width <= 0 || box.height <= 0) {
    return { x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height }
  }
  const area = { width: workArea.width, height: workArea.height }
  const pos = placeOverlayBox(layout.position, area, box)
  const m = OVERLAY_WINDOW_MARGIN
  const left = Math.max(0, Math.round(pos.left - m))
  const top = Math.max(0, Math.round(pos.top - m))
  const right = Math.min(area.width, Math.round(pos.left + box.width + m))
  const bottom = Math.min(area.height, Math.round(pos.top + box.height + m))
  return { x: workArea.x + left, y: workArea.y + top, width: right - left, height: bottom - top }
}

export function overlayFrame(workArea: Rect, rect: Rect): OverlayFrame {
  return {
    area: { width: workArea.width, height: workArea.height },
    origin: { x: rect.x - workArea.x, y: rect.y - workArea.y }
  }
}

/** Sai do modo de edição (o de entrar é configurável: lib/overlayShortcut). */
export const OVERLAY_EXIT_SHORTCUT = 'Escape'

export interface OverlayShortcutState {
  /** Janela do overlay à vista (em call, jogo em tela cheia na frente). */
  visible: boolean
  /** Modo de edição (mover/redimensionar) ligado. */
  editing: boolean
  quitting: boolean
}

/**
 * Atalhos globais que o overlay segura agora. Só com ele à vista: o atalho de
 * edição (padrão Shift+Tab) nunca é roubado de outros apps nem da área de trabalho. Esc só no modo de
 * edição.
 */
export function overlayShortcuts(state: OverlayShortcutState): {
  toggleEdit: boolean
  exitEdit: boolean
} {
  const toggleEdit = state.visible && !state.quitting
  return { toggleEdit, exitEdit: toggleEdit && state.editing }
}
