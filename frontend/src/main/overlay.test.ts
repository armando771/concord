import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  state: {
    handlers: {} as Record<string, (...a: unknown[]) => unknown>,
    appHandlers: {} as Record<string, ((...a: unknown[]) => unknown)[]>,
    windows: [] as {
      destroyed: boolean
      contentProtection: boolean
      visible: boolean
    }[],
    watching: false,
    onChange: null as ((fg: unknown) => void) | null
  }
}))

vi.mock('electron', () => {
  class BrowserWindow {
    destroyed = false
    contentProtection = false
    visible = false
    webContents = { send: (): void => {} }
    constructor() {
      h.state.windows.push(this)
    }
    setIgnoreMouseEvents = vi.fn()
    setAlwaysOnTop = vi.fn()
    setContentProtection(on: boolean): void {
      this.contentProtection = on
    }
    on = vi.fn()
    loadFile = vi.fn()
    loadURL = vi.fn()
    setBounds = vi.fn()
    isVisible(): boolean {
      return this.visible
    }
    showInactive(): void {
      this.visible = true
    }
    moveTop = vi.fn()
    hide(): void {
      this.visible = false
    }
    destroy(): void {
      this.destroyed = true
    }
  }
  return {
    BrowserWindow,
    app: {
      on: (ev: string, fn: (...a: unknown[]) => unknown) =>
        (h.state.appHandlers[ev] ??= []).push(fn)
    },
    ipcMain: {
      handle: (ch: string, fn: (...a: unknown[]) => unknown) => (h.state.handlers[ch] = fn),
      on: (ch: string, fn: (...a: unknown[]) => unknown) => (h.state.handlers[ch] = fn)
    },
    screen: {
      screenToDipRect: (_w: unknown, r: unknown) => r,
      getDisplayMatching: (r: unknown) => ({ bounds: r })
    }
  }
})
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('./foregroundWatch', () => ({
  startForegroundWatch: (fn: (fg: unknown) => void) => {
    h.state.watching = true
    h.state.onChange = fn
  },
  stopForegroundWatch: () => {
    h.state.watching = false
  }
}))

const inCall = { enabled: true, inCall: true, members: [], more: 0 }
const game = { pid: 4242, monitor: { x: 0, y: 0, width: 1920, height: 1080 } }
const realPlatform = process.platform

async function setup(): Promise<void> {
  const { setupOverlay } = await import('./overlay')
  setupOverlay(() => null)
}

const sendState = (s: unknown): unknown => h.state.handlers['overlay:state']({}, s)
const quit = (): void => h.state.appHandlers['before-quit'].forEach((fn) => fn())

beforeEach(() => {
  vi.resetModules()
  Object.defineProperty(process, 'platform', { value: 'win32' })
  h.state.handlers = {}
  h.state.appHandlers = {}
  h.state.windows = []
  h.state.watching = false
  h.state.onChange = null
})

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform })
})

describe('overlay', () => {
  it('jogo em tela cheia em call abre a janela, fora da captura de tela', async () => {
    await setup()
    sendState(inCall)
    expect(h.state.watching).toBe(true)
    h.state.onChange?.(game)
    expect(h.state.windows).toHaveLength(1)
    expect(h.state.windows[0]).toMatchObject({ visible: true, contentProtection: true })
  })

  it('ao sair do app: fecha tudo e ignora estados atrasados do renderer', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    quit()
    expect(h.state.watching).toBe(false)
    expect(h.state.windows[0].destroyed).toBe(true)
    expect(h.state.handlers['overlay:current']()).toBeNull()

    sendState(inCall)
    h.state.onChange?.(game)
    expect(h.state.watching).toBe(false)
    expect(h.state.windows).toHaveLength(1)
  })
})
