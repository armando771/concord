import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks do Electron / electron-updater (estado compartilhado por teste) ──
const h = vi.hoisted(() => {
  const listeners: Record<string, Array<(...a: unknown[]) => unknown>> = {}
  const state = {
    inCall: false,
    validSignature: true,
    handlers: {} as Record<string, (...a: unknown[]) => unknown>,
    sent: [] as Array<[string, unknown]>,
    callListeners: [] as Array<(s: { inCall: boolean }) => void>
  }
  const autoUpdater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(async () => null),
    downloadUpdate: vi.fn(async () => []),
    quitAndInstall: vi.fn(),
    on: (event: string, fn: (...a: unknown[]) => unknown) => {
      ;(listeners[event] ??= []).push(fn)
    },
    emit: async (event: string, ...args: unknown[]) => {
      for (const fn of listeners[event] ?? []) await fn(...args)
    },
    reset: () => {
      for (const k of Object.keys(listeners)) delete listeners[k]
    }
  }
  return { state, autoUpdater }
})

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => '/tmp/concord-teste' },
  ipcMain: {
    handle: (ch: string, fn: (...a: unknown[]) => unknown) => (h.state.handlers[ch] = fn),
    on: (ch: string, fn: (...a: unknown[]) => unknown) => (h.state.handlers[ch] = fn)
  },
  net: { fetch: async () => ({ ok: true, text: async () => 'assinatura' }) }
}))
vi.mock('electron-updater', () => ({ autoUpdater: h.autoUpdater }))
vi.mock('fs/promises', () => ({
  readFile: async () => Buffer.from('instalador'),
  rm: async () => {},
  writeFile: async () => {}
}))
vi.mock('fs', () => ({
  readFileSync: () => {
    throw new Error('sem arquivo')
  }
}))
vi.mock('./background', () => ({
  isInCall: () => h.state.inCall,
  markQuitting: vi.fn(),
  onCallStateChange: (fn: (s: { inCall: boolean }) => void) => h.state.callListeners.push(fn)
}))
vi.mock('./updateSignature', () => ({ verifyInstaller: () => h.state.validSignature }))

const win = { webContents: { send: (ch: string, v: unknown) => h.state.sent.push([ch, v]) } }

async function startUpdater(): Promise<void> {
  const { setupUpdater } = await import('./updater')
  setupUpdater(() => win as never, { feedUrl: 'http://srv/updates/', publicKeyPem: 'chave' })
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setInterval'] })
  h.autoUpdater.reset()
  vi.clearAllMocks()
  h.state.inCall = false
  h.state.validSignature = true
  h.state.handlers = {}
  h.state.sent = []
  h.state.callListeners = []
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('updater', () => {
  it('avisa assim que existe versão nova, mesmo em chamada (sem baixar ainda)', async () => {
    h.state.inCall = true
    await startUpdater()

    await h.autoUpdater.emit('update-available', { version: '0.6.0' })

    expect(h.state.sent).toContainEqual(['update:available', '0.6.0'])
    expect(h.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
  })

  it('clicar Atualizar em chamada baixa agora e instala depois de verificar', async () => {
    h.state.inCall = true
    await startUpdater()
    await h.autoUpdater.emit('update-available', { version: '0.6.0' })

    h.state.handlers['update:install']()
    expect(h.autoUpdater.downloadUpdate).toHaveBeenCalled()

    await h.autoUpdater.emit('update-downloaded', {
      version: '0.6.0',
      downloadedFile: 'C:/x/setup.exe'
    })
    await flush()
    expect(h.autoUpdater.quitAndInstall).toHaveBeenCalled()
  })

  it('fora de chamada já baixa em segundo plano; clicar instala na hora', async () => {
    await startUpdater()
    await h.autoUpdater.emit('update-available', { version: '0.6.0' })
    expect(h.autoUpdater.downloadUpdate).toHaveBeenCalled()

    await h.autoUpdater.emit('update-downloaded', {
      version: '0.6.0',
      downloadedFile: 'C:/x/setup.exe'
    })
    await flush()
    expect(h.state.sent).toContainEqual(['update:ready', '0.6.0'])
    expect(h.autoUpdater.quitAndInstall).not.toHaveBeenCalled()

    h.state.handlers['update:install']()
    expect(h.autoUpdater.quitAndInstall).toHaveBeenCalled()
  })

  it('versão mais nova substitui a que já estava baixada', async () => {
    await startUpdater()
    await h.autoUpdater.emit('update-available', { version: '0.6.0' })
    await h.autoUpdater.emit('update-downloaded', {
      version: '0.6.0',
      downloadedFile: 'C:/x/a.exe'
    })
    await flush()
    h.autoUpdater.downloadUpdate.mockClear()

    await h.autoUpdater.emit('update-available', { version: '0.6.1' })

    expect(h.state.sent).toContainEqual(['update:available', '0.6.1'])
    expect(h.autoUpdater.downloadUpdate).toHaveBeenCalled()
    expect(await h.state.handlers['update:status']()).toEqual({ version: '0.6.1', ready: false })
  })

  it('assinatura inválida nunca instala, mesmo depois de clicar Atualizar', async () => {
    h.state.validSignature = false
    await startUpdater()
    await h.autoUpdater.emit('update-available', { version: '0.6.0' })
    h.state.handlers['update:install']()

    await h.autoUpdater.emit('update-downloaded', {
      version: '0.6.0',
      downloadedFile: 'C:/x/setup.exe'
    })
    await flush()

    expect(h.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    expect(h.state.sent.some(([ch]) => ch === 'update:error')).toBe(true)
  })

  it('checa de novo a cada 5 minutos com o app aberto', async () => {
    await startUpdater()
    expect(h.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5 * 60_000)
    expect(h.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2)
  })
})
