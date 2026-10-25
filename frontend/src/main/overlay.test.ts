import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  state: {
    handlers: {} as Record<string, (...a: unknown[]) => unknown>,
    appHandlers: {} as Record<string, ((...a: unknown[]) => unknown)[]>,
    windows: [] as {
      destroyed: boolean
      contentProtection: boolean
      visible: boolean
      ignoreMouse: boolean | null
      bounds: unknown
      sent: [string, unknown][]
      webContents: unknown
    }[],
    shortcuts: {} as Record<string, () => void>,
    shortcutsTaken: [] as string[],
    watching: false,
    onChange: null as ((fg: unknown) => void) | null
  }
}))

vi.mock('electron', () => {
  class BrowserWindow {
    destroyed = false
    contentProtection = false
    visible = false
    ignoreMouse: boolean | null = null
    bounds: unknown = null
    sent: [string, unknown][] = []
    webContents = {
      send: (channel: string, payload: unknown): void => {
        this.sent.push([channel, payload])
      }
    }
    constructor() {
      h.state.windows.push(this)
    }
    setIgnoreMouseEvents(ignore: boolean): void {
      this.ignoreMouse = ignore
    }
    setAlwaysOnTop = vi.fn()
    setContentProtection(on: boolean): void {
      this.contentProtection = on
    }
    on = vi.fn()
    loadFile = vi.fn()
    loadURL = vi.fn()
    setBounds(bounds: unknown): void {
      this.bounds = bounds
    }
    getBounds(): unknown {
      return this.bounds
    }
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
    globalShortcut: {
      register: (accel: string, fn: () => void): boolean => {
        if (h.state.shortcutsTaken.includes(accel)) return false
        h.state.shortcuts[accel] = fn
        return true
      },
      unregister: (accel: string): void => {
        delete h.state.shortcuts[accel]
      }
    },
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
      getDisplayMatching: (r: { x: number; y: number; width: number; height: number }) => ({
        bounds: r,
        workArea: { ...r, height: r.height - 40 }
      })
    }
  }
})
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('./appLog', () => ({ appendLog: () => {} }))
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

const mainWindow = {
  sent: [] as [string, unknown][],
  webContents: {
    send: (channel: string, payload: unknown): void => {
      mainWindow.sent.push([channel, payload])
    }
  }
}

async function setup(): Promise<void> {
  const { setupOverlay } = await import('./overlay')
  setupOverlay(() => mainWindow as never)
}

const shortcuts = (): string[] => Object.keys(h.state.shortcuts).sort()
const press = (accel: string): void => h.state.shortcuts[accel]()
const lastEditing = (w: (typeof h.state.windows)[number]): unknown =>
  w.sent.filter(([ch]) => ch === 'overlay:editing').at(-1)?.[1]

const sendState = (s: unknown): unknown => h.state.handlers['overlay:state']({}, s)
const quit = (): void => h.state.appHandlers['before-quit'].forEach((fn) => fn())

beforeEach(() => {
  vi.resetModules()
  Object.defineProperty(process, 'platform', { value: 'win32' })
  h.state.handlers = {}
  h.state.appHandlers = {}
  h.state.windows = []
  h.state.shortcuts = {}
  h.state.shortcutsTaken = []
  mainWindow.sent = []
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
    expect(h.state.windows[0]).toMatchObject({
      visible: true,
      contentProtection: true,
      ignoreMouse: true
    })
  })

  it('a janela cobre a área de trabalho do monitor do jogo', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    expect(h.state.windows[0].bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1040 })
  })

  it('Shift+Tab só fica registrado com o overlay à vista', async () => {
    await setup()
    sendState(inCall)
    expect(shortcuts()).toEqual([])
    h.state.onChange?.(game)
    expect(shortcuts()).toEqual(['Shift+Tab'])
    h.state.onChange?.(null)
    expect(h.state.windows[0].visible).toBe(false)
    expect(shortcuts()).toEqual([])
  })

  it('Shift+Tab liga a edição: aceita o mouse e segura o Esc; Shift+Tab de novo desliga', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    const w = h.state.windows[0]
    press('Shift+Tab')
    expect(w.ignoreMouse).toBe(false)
    expect(lastEditing(w)).toBe(true)
    expect(shortcuts()).toEqual(['Escape', 'Shift+Tab'])
    press('Shift+Tab')
    expect(w.ignoreMouse).toBe(true)
    expect(lastEditing(w)).toBe(false)
    expect(shortcuts()).toEqual(['Shift+Tab'])
  })

  it('Esc sai da edição e solta o Esc', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    const w = h.state.windows[0]
    press('Shift+Tab')
    press('Escape')
    expect(w.ignoreMouse).toBe(true)
    expect(lastEditing(w)).toBe(false)
    expect(shortcuts()).toEqual(['Shift+Tab'])
  })

  it('overlay some no meio da edição: volta a ignorar o mouse e solta os atalhos', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    const w = h.state.windows[0]
    press('Shift+Tab')
    h.state.onChange?.(null)
    expect(w.ignoreMouse).toBe(true)
    expect(shortcuts()).toEqual([])
    // Volta o jogo: sem edição pendurada.
    h.state.onChange?.(game)
    expect(w.ignoreMouse).toBe(true)
    expect(lastEditing(w)).toBe(false)
    expect(shortcuts()).toEqual(['Shift+Tab'])
  })

  it('fim da call no meio da edição solta os atalhos', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    press('Shift+Tab')
    sendState({ ...inCall, inCall: false })
    expect(h.state.windows[0].destroyed).toBe(true)
    expect(shortcuts()).toEqual([])
  })

  it('atalho ocupado por outro app não quebra o overlay', async () => {
    h.state.shortcutsTaken = ['Shift+Tab']
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    expect(h.state.windows[0].visible).toBe(true)
    expect(shortcuts()).toEqual([])
  })

  it('posição nova vinda do overlay vai para o renderer principal salvar', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    const w = h.state.windows[0]
    h.state.handlers['overlay:layout'](
      { sender: w.webContents },
      { position: { x: 0.5, y: 2 }, scale: 1.2 }
    )
    expect(mainWindow.sent).toEqual([
      ['overlay:layout', { position: { x: 0.5, y: 1 }, scale: 1.2 }]
    ])
    // De outra página: ignorado.
    h.state.handlers['overlay:layout']({ sender: {} }, { position: null, scale: 1 })
    expect(mainWindow.sent).toHaveLength(1)
  })

  it('ao sair do app: fecha tudo e ignora estados atrasados do renderer', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    press('Shift+Tab')
    quit()
    expect(shortcuts()).toEqual([])
    expect(h.state.watching).toBe(false)
    expect(h.state.windows[0].destroyed).toBe(true)
    expect(h.state.handlers['overlay:current']()).toBeNull()

    sendState(inCall)
    h.state.onChange?.(game)
    expect(h.state.watching).toBe(false)
    expect(h.state.windows).toHaveLength(1)
    expect(shortcuts()).toEqual([])
  })
})
