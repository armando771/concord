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

export const OVERLAY_WIDTH = 280

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

/** Janela do overlay: faixa de OVERLAY_WIDTH na borda esquerda, altura toda do monitor (o CSS centraliza a lista na vertical). */
export function overlayBounds(display: Rect): Rect {
  return { x: display.x, y: display.y, width: OVERLAY_WIDTH, height: display.height }
}
