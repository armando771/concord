import type { BrowserWindow } from 'electron'
import { sameActivity, type WindowActivity } from '../../shared/windowActivity'

// Segundo plano da janela principal: avisa o renderer (que pausa animações e
// laços de desenho) e liga o throttling do Chromium quando não há chamada.

type ActivityWindow = Pick<BrowserWindow, 'isFocused' | 'isVisible' | 'isMinimized'>

export function readActivity(win: ActivityWindow): WindowActivity {
  const visible = win.isVisible() && !win.isMinimized()
  return { focused: visible && win.isFocused(), visible }
}

/**
 * Sem chamada o Chromium pode reduzir timers e parar de desenhar a janela oculta
 * (minimizada, na bandeja ou coberta pelo jogo). Em chamada não: com o renderer
 * em segundo plano a live (captura de tela/WebRTC) trava para quem assiste.
 */
export const allowBackgroundThrottling = (inCall: boolean): boolean => !inCall

export interface CallStateSource {
  inCall(): boolean
  onCallStateChange(listener: (state: { inCall: boolean }) => void): void
}

const EVENTS = ['focus', 'blur', 'minimize', 'restore', 'show', 'hide'] as const

export function watchWindowActivity(win: BrowserWindow, calls: CallStateSource): void {
  let last: WindowActivity | null = null
  const push = (): void => {
    if (win.isDestroyed()) return
    const now = readActivity(win)
    if (last && sameActivity(last, now)) return
    last = now
    win.webContents.send('window:activity', now)
  }
  for (const event of EVENTS) win.on(event as 'focus', push)
  win.webContents.on('did-finish-load', () => {
    last = null
    push()
  })

  const throttle = (inCall: boolean): void => {
    if (!win.isDestroyed()) win.webContents.setBackgroundThrottling(allowBackgroundThrottling(inCall))
  }
  throttle(calls.inCall())
  calls.onCallStateChange((state) => throttle(state.inCall))
}
