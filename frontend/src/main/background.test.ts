import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mock do Electron: o atalho de login se comporta como no Windows ───────
// (openAtLogin só bate quando a leitura passa os mesmos args da gravação).
const h = vi.hoisted(() => ({
  state: {
    handlers: {} as Record<string, (...a: unknown[]) => unknown>,
    loginItem: null as { openAtLogin: boolean; args: string[] } | null
  }
}))

vi.mock('electron', () => {
  const sameArgs = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((x, i) => x === b[i])
  return {
    app: {
      isPackaged: true,
      getPath: () => '/tmp/concord-teste',
      on: vi.fn(),
      setLoginItemSettings: (s: { openAtLogin: boolean; args?: string[] }) => {
        h.state.loginItem = { openAtLogin: s.openAtLogin, args: s.args ?? [] }
      },
      getLoginItemSettings: (o: { args?: string[] } = {}) => {
        const item = h.state.loginItem
        const openAtLogin = !!item && item.openAtLogin && sameArgs(o.args ?? [], item.args)
        return { openAtLogin, launchItems: [] }
      }
    },
    ipcMain: {
      handle: (ch: string, fn: (...a: unknown[]) => unknown) => (h.state.handlers[ch] = fn),
      on: (ch: string, fn: (...a: unknown[]) => unknown) => (h.state.handlers[ch] = fn)
    },
    Menu: { buildFromTemplate: () => ({}) },
    nativeImage: { createFromPath: () => ({}) },
    Notification: class {
      static isSupported = (): boolean => true
    },
    Tray: class {
      on = vi.fn()
      setToolTip = vi.fn()
      setContextMenu = vi.fn()
    }
  }
})
vi.mock('fs', () => ({
  existsSync: () => true,
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: () => {
    throw new Error('sem arquivo')
  }
}))

const realPlatform = process.platform

async function setup(): Promise<void> {
  const { setupBackground } = await import('./background')
  setupBackground(() => null, 'icone.png')
}

const invoke = (ch: string, ...args: unknown[]): unknown => h.state.handlers[ch]({}, ...args)

beforeEach(() => {
  vi.resetModules()
  Object.defineProperty(process, 'platform', { value: 'win32' })
  h.state.handlers = {}
  h.state.loginItem = null
})

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform })
})

describe('Iniciar com o Windows', () => {
  it('ligar e reabrir as configurações continua mostrando ligado', async () => {
    await setup()
    await invoke('settings:set-autostart', false)
    expect(await invoke('settings:autostart')).toBe(false)
    await invoke('settings:set-autostart', true)
    expect(await invoke('settings:autostart')).toBe(true)
  })

  it('primeira execução já vem ligada e a tela de configurações vê isso', async () => {
    await setup()
    expect(await invoke('settings:autostart')).toBe(true)
  })
})
