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
  const fetch = vi.fn(async () => ({ ok: true, text: async () => 'assinatura' }))
  return { state, autoUpdater, fetch }
})

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => '/tmp/concord-teste' },
  ipcMain: {
    handle: (ch: string, fn: (...a: unknown[]) => unknown) => (h.state.handlers[ch] = fn),
    on: (ch: string, fn: (...a: unknown[]) => unknown) => (h.state.handlers[ch] = fn)
  },
  net: { fetch: h.fetch }
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
vi.mock('./callResume', () => ({
  takeCallResume: vi.fn(() => null),
  saveCallResume: vi.fn(),
  clearCallResume: vi.fn()
}))

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
  it('entrega a retomada uma única vez e somente à janela principal', async () => {
    const { takeCallResume } = await import('./callResume')
    const pending = {
      userId: 'u',
      backendUrl: 'api',
      serverId: 's',
      channelId: 'c',
      muted: false,
      deafened: false,
      mutedBeforeDeafen: false,
      savedAt: Date.now()
    }
    vi.mocked(takeCallResume).mockReturnValueOnce(pending)
    await startUpdater()
    expect(h.state.handlers['update:take-call-resume']({ sender: {} })).toBeNull()
    expect(h.state.handlers['update:take-call-resume']({ sender: win.webContents })).toEqual(
      pending
    )
    expect(h.state.handlers['update:take-call-resume']({ sender: win.webContents })).toBeNull()
  })

  it('não instala quando falha ao gravar a retomada', async () => {
    await startUpdater()
    const { saveCallResume } = await import('./callResume')
    vi.mocked(saveCallResume).mockImplementationOnce(() => {
      throw new Error('disk full')
    })
    await h.autoUpdater.emit('update-available', { version: '0.6.1' })
    await h.autoUpdater.emit('update-downloaded', { version: '0.6.1', downloadedFile: 'setup.exe' })
    h.state.handlers['update:install']()
    expect(h.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    expect(h.state.sent.some(([channel]) => channel === 'update:error')).toBe(true)
  })

  it('verifica a assinatura do AppImage pelo nome no cache antes de instalar', async () => {
    await startUpdater()
    await h.autoUpdater.emit('update-available', { version: '0.7.0' })
    await h.autoUpdater.emit('update-downloaded', {
      version: '0.7.0',
      downloadedFile: '/home/user/.cache/salinha-updater/pending/Salinha-0.7.0-x64.AppImage'
    })
    expect(h.fetch).toHaveBeenCalledWith('http://srv/updates/Salinha-0.7.0-x64.AppImage.sig')
    expect(h.state.sent).toContainEqual(['update:ready', '0.7.0'])
    h.state.handlers['update:install']()
    expect(h.autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })

  it('recusa AppImage com assinatura inválida', async () => {
    h.state.validSignature = false
    await startUpdater()
    await h.autoUpdater.emit('update-available', { version: '0.7.0' })
    h.state.handlers['update:install']()
    await h.autoUpdater.emit('update-downloaded', {
      version: '0.7.0',
      downloadedFile: '/cache/Salinha-0.7.0-x64.AppImage'
    })
    expect(h.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    expect(h.state.sent.some(([channel]) => channel === 'update:error')).toBe(true)
  })

  it('limpa a retomada quando o instalador falha', async () => {
    await startUpdater()
    const { clearCallResume } = await import('./callResume')
    await h.autoUpdater.emit('update-available', { version: '0.6.1' })
    await h.autoUpdater.emit('update-downloaded', { version: '0.6.1', downloadedFile: 'setup.exe' })
    h.state.handlers['update:install']()
    await h.autoUpdater.emit('error', new Error('installer failed'))
    expect(clearCallResume).toHaveBeenCalled()
  })

  it('salva o estado mais recente antes de instalar e ignora IPC de outra janela', async () => {
    await startUpdater()
    const { saveCallResume } = await import('./callResume')
    const snapshot = {
      userId: 'u',
      backendUrl: 'api',
      serverId: 's',
      channelId: 'c',
      muted: true,
      deafened: false,
      mutedBeforeDeafen: false
    }
    await h.autoUpdater.emit('update-available', { version: '0.6.1' })
    await h.autoUpdater.emit('update-downloaded', {
      version: '0.6.1',
      downloadedFile: 'setup.exe'
    })
    expect(saveCallResume).not.toHaveBeenCalled()
    h.state.handlers['update:call-snapshot']({ sender: win.webContents }, snapshot)
    h.state.handlers['update:call-snapshot']({ sender: {} }, null)
    h.state.handlers['update:install']()
    expect(saveCallResume).toHaveBeenCalledWith(snapshot)
    expect(vi.mocked(saveCallResume).mock.invocationCallOrder[0]).toBeLessThan(
      h.autoUpdater.quitAndInstall.mock.invocationCallOrder[0]
    )
  })

  it('recusa AppImage se a assinatura não estiver publicada', async () => {
    h.fetch.mockResolvedValueOnce({ ok: false, text: async () => '' })
    await startUpdater()
    await h.autoUpdater.emit('update-available', { version: '0.7.0' })
    await h.autoUpdater.emit('update-downloaded', {
      version: '0.7.0',
      downloadedFile: '/cache/Salinha-0.7.0-x64.AppImage'
    })
    expect(h.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    expect(h.state.sent.some(([channel]) => channel === 'update:error')).toBe(true)
  })

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
