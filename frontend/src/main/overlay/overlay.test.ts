import { join } from 'node:path'
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
      contentsHandlers: Record<string, () => void>
      setBoundsCalls: number
    }[],
    shortcuts: {} as Record<string, () => void>,
    shortcutsTaken: [] as string[],
    watching: false,
    onChange: null as ((fg: unknown) => void) | null,
    helperExists: false,
    helpers: [] as {
      written: string[]
      killed: boolean
      handlers: Record<string, ((...a: unknown[]) => void)[]>
      stdout: import('node:stream').PassThrough
    }[]
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
    contentsHandlers: Record<string, () => void> = {}
    webContents = {
      send: (channel: string, payload: unknown): void => {
        this.sent.push([channel, payload])
      },
      on: (event: string, fn: () => void): void => {
        this.contentsHandlers[event] = fn
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
    setBoundsCalls = 0
    setBounds(bounds: unknown): void {
      this.setBoundsCalls++
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
vi.mock('../app/appLog', () => ({ appendLog: () => {} }))
vi.mock('./nativeHelper', async () => {
  const { PassThrough } = await import('node:stream')
  return {
    nativeHelperExists: () => h.state.helperExists,
    overlayAvatarStore: () => ({ path: () => undefined, onChange: () => {} }),
    startNativeHelper: () => {
      const helper = {
        written: [] as string[],
        killed: false,
        handlers: {} as Record<string, ((...a: unknown[]) => void)[]>,
        stdout: new PassThrough(),
        stderr: null,
        stdin: {
          write: (line: string) => helper.written.push(line.trim()),
          end: () => {},
          on: () => {}
        },
        on: (ev: string, fn: (...a: unknown[]) => void) => (helper.handlers[ev] ??= []).push(fn),
        kill: () => {
          helper.killed = true
        }
      }
      h.state.helpers.push(helper)
      return helper
    }
  }
})
vi.mock('../activity/foregroundWatch', () => ({
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
/** Página do overlay avisa que carregou (e pergunta o estado atual). */
const ready = (w = h.state.windows.at(-1)): unknown =>
  h.state.handlers['overlay:ready']({ sender: w?.webContents })
const reportBox = (size: unknown, w = h.state.windows.at(-1)): unknown =>
  h.state.handlers['overlay:box']({ sender: w?.webContents }, size)
const lastFrame = (w: (typeof h.state.windows)[number]): unknown =>
  w.sent.filter(([ch]) => ch === 'overlay:frame').at(-1)?.[1]
const workArea = { x: 0, y: 0, width: 1920, height: 1040 }
/** Caixa 200×120 na posição padrão (esquerda, meio): janela só em volta dela. */
const boxRect = { x: 0, y: 452, width: 216, height: 136 }
/** Jogo na frente e página do overlay pronta. */
const showGame = (): void => {
  h.state.onChange?.(game)
  ready()
}
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
  h.state.helperExists = false
  h.state.helpers = []
  delete process.env.SALINHA_OVERLAY
})

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform })
})

describe('overlay', () => {
  it('jogo em tela cheia em call abre a janela, fora da captura de tela', async () => {
    await setup()
    sendState(inCall)
    expect(h.state.watching).toBe(true)
    showGame()
    expect(h.state.windows).toHaveLength(1)
    expect(h.state.windows[0]).toMatchObject({
      visible: true,
      contentProtection: true,
      ignoreMouse: true
    })
  })

  it('no build, carrega o overlay.html ao lado do index.html (out/renderer)', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0] as unknown as { loadFile: { mock: { calls: string[][] } } }
    // O main é empacotado em out/main/index.js: o renderer fica em ../renderer.
    expect(w.loadFile.mock.calls).toEqual([[join(__dirname, '../renderer/overlay.html')]])
  })

  it('estado repetido ou só de fala não refaz z-order nem reenvia o que a página já tem', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0] as unknown as {
      setAlwaysOnTop: { mock: { calls: unknown[] } }
      moveTop: { mock: { calls: unknown[] } }
      sent: [string, unknown][]
    }
    const updates = (): number => w.sent.filter(([ch]) => ch === 'overlay:update').length
    const raised = [w.setAlwaysOnTop.mock.calls.length, w.moveTop.mock.calls.length]
    const sentBefore = updates()
    sendState({ ...inCall })
    sendState({ ...inCall })
    expect([w.setAlwaysOnTop.mock.calls.length, w.moveTop.mock.calls.length]).toEqual(raised)
    expect(updates()).toBe(sentBefore)
    sendState({ ...inCall, more: 1 })
    expect(updates()).toBe(sentBefore + 1)
  })

  it('com o jogo fora da frente (janela oculta), não manda estado à página', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0]
    h.state.onChange?.(null)
    const sentBefore = w.sent.length
    sendState({ ...inCall, more: 2 })
    expect(w.sent.slice(sentBefore).filter(([ch]) => ch === 'overlay:update')).toEqual([])
    // Ao voltar o jogo, a página recebe o estado novo.
    h.state.onChange?.(game)
    expect(w.sent.filter(([ch]) => ch === 'overlay:update').at(-1)?.[1]).toMatchObject({ more: 2 })
  })

  it('outro jogo na frente sobe o z-order de novo', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0] as unknown as { moveTop: { mock: { calls: unknown[] } } }
    const before = w.moveTop.mock.calls.length
    h.state.onChange?.({ ...game, pid: 999 })
    expect(w.moveTop.mock.calls.length).toBe(before + 1)
  })

  it('antes de a página medir a lista, a janela cobre a área de trabalho', async () => {
    await setup()
    sendState(inCall)
    showGame()
    expect(h.state.windows[0].bounds).toEqual(workArea)
  })

  it('com a lista medida, a janela fica só em volta dela; a página sabe onde ela está', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0]
    reportBox({ width: 200, height: 120 })
    expect(w.bounds).toEqual(boxRect)
    expect(lastFrame(w)).toEqual({
      area: { width: 1920, height: 1040 },
      origin: { x: 0, y: 452 }
    })
    expect(ready()).toMatchObject({
      frame: { area: { width: 1920, height: 1040 }, origin: { x: 0, y: 452 } }
    })
  })

  it('editando, a janela cresce para a área inteira; ao sair, volta para a lista', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0]
    reportBox({ width: 200, height: 120 })
    press('Shift+Tab')
    expect(w.bounds).toEqual(workArea)
    expect(lastFrame(w)).toEqual({ area: { width: 1920, height: 1040 }, origin: { x: 0, y: 0 } })
    press('Escape')
    expect(w.bounds).toEqual(boxRect)
  })

  it('posição nova da página move a janela na hora (sem esperar o renderer principal)', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0]
    reportBox({ width: 200, height: 120 })
    press('Shift+Tab')
    h.state.handlers['overlay:layout'](
      { sender: w.webContents },
      { position: { x: 0.5, y: 0.25 }, scale: 1 }
    )
    press('Shift+Tab')
    expect(w.bounds).toEqual({ x: 952, y: 252, width: 216, height: 136 })
    // O estado salvo chega com a mesma posição: nada muda.
    sendState({ ...inCall, layout: { position: { x: 0.5, y: 0.25 }, scale: 1 } })
    expect(w.bounds).toEqual({ x: 952, y: 252, width: 216, height: 136 })
    // "Restaurar posição" nas configurações vence.
    sendState({ ...inCall, layout: { position: null, scale: 1 } })
    expect(w.bounds).toEqual(boxRect)
  })

  it('não mexe na janela a cada estado novo (ex.: alguém falando)', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0]
    reportBox({ width: 200, height: 120 })
    const calls = w.setBoundsCalls
    sendState({ ...inCall })
    sendState({ ...inCall })
    reportBox({ width: 200, height: 120 })
    expect(w.setBoundsCalls).toBe(calls)
  })

  it('tamanho da lista de outra página ou estragado é ignorado', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0]
    h.state.handlers['overlay:box']({ sender: {} }, { width: 200, height: 120 })
    reportBox({ width: 'x', height: 120 })
    reportBox(null)
    expect(w.bounds).toEqual(workArea)
  })

  it('recarregar a página volta para a área inteira até ela medir de novo', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0]
    reportBox({ width: 200, height: 120 })
    w.contentsHandlers['did-start-loading']()
    expect(w.bounds).toEqual(workArea)
  })

  it('Shift+Tab só fica registrado com o overlay à vista', async () => {
    await setup()
    sendState(inCall)
    expect(shortcuts()).toEqual([])
    showGame()
    expect(shortcuts()).toEqual(['Shift+Tab'])
    h.state.onChange?.(null)
    expect(h.state.windows[0].visible).toBe(false)
    expect(shortcuts()).toEqual([])
  })

  it('Shift+Tab liga a edição: aceita o mouse e segura o Esc; Shift+Tab de novo desliga', async () => {
    await setup()
    sendState(inCall)
    showGame()
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
    showGame()
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
    showGame()
    const w = h.state.windows[0]
    press('Shift+Tab')
    h.state.onChange?.(null)
    expect(w.ignoreMouse).toBe(true)
    expect(shortcuts()).toEqual([])
    // Volta o jogo: sem edição pendurada.
    showGame()
    expect(w.ignoreMouse).toBe(true)
    expect(lastEditing(w)).toBe(false)
    expect(shortcuts()).toEqual(['Shift+Tab'])
  })

  it('fim da call no meio da edição solta os atalhos', async () => {
    await setup()
    sendState(inCall)
    showGame()
    press('Shift+Tab')
    sendState({ ...inCall, inCall: false })
    expect(h.state.windows[0].destroyed).toBe(true)
    expect(shortcuts()).toEqual([])
  })

  it('atalho ocupado por outro app não quebra o overlay', async () => {
    h.state.shortcutsTaken = ['Shift+Tab']
    await setup()
    sendState(inCall)
    showGame()
    expect(h.state.windows[0].visible).toBe(true)
    expect(shortcuts()).toEqual([])
  })

  it('posição nova vinda do overlay vai para o renderer principal salvar', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0]
    h.state.handlers['overlay:layout'](
      { sender: w.webContents },
      { position: { x: 0.5, y: 2 }, scale: 1.2 }
    )
    const layouts = (): unknown[] => mainWindow.sent.filter(([ch]) => ch === 'overlay:layout')
    expect(layouts()).toEqual([['overlay:layout', { position: { x: 0.5, y: 1 }, scale: 1.2 }]])
    // De outra página: ignorado.
    h.state.handlers['overlay:layout']({ sender: {} }, { position: null, scale: 1 })
    expect(layouts()).toHaveLength(1)
  })

  it('ao sair do app: fecha tudo e ignora estados atrasados do renderer', async () => {
    await setup()
    sendState(inCall)
    showGame()
    press('Shift+Tab')
    quit()
    expect(shortcuts()).toEqual([])
    expect(h.state.watching).toBe(false)
    expect(h.state.windows[0].destroyed).toBe(true)
    expect(ready()).toMatchObject({ snapshot: null, editing: false })

    sendState(inCall)
    showGame()
    expect(h.state.watching).toBe(false)
    expect(h.state.windows).toHaveLength(1)
    expect(shortcuts()).toEqual([])
  })

  it('Shift+Tab antes da página carregar é ignorado (nada de clique preso sem moldura)', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    const w = h.state.windows[0]
    press('Shift+Tab')
    expect(w.ignoreMouse).toBe(true)
    expect(lastEditing(w)).toBeUndefined()
    expect(ready()).toMatchObject({ snapshot: inCall, editing: false })
    press('Shift+Tab')
    expect(w.ignoreMouse).toBe(false)
    expect(lastEditing(w)).toBe(true)
  })

  it('a página pergunta o estado de edição ao carregar', async () => {
    await setup()
    sendState(inCall)
    showGame()
    press('Shift+Tab')
    expect(ready()).toMatchObject({ snapshot: inCall, editing: true })
  })

  it('"pronto" de outra página não libera o atalho', async () => {
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    h.state.handlers['overlay:ready']({ sender: {} })
    press('Shift+Tab')
    expect(h.state.windows[0].ignoreMouse).toBe(true)
  })

  it('recarregar a página no meio da edição sai da edição e volta o click-through', async () => {
    await setup()
    sendState(inCall)
    showGame()
    const w = h.state.windows[0]
    press('Shift+Tab')
    w.contentsHandlers['did-start-loading']()
    expect(w.ignoreMouse).toBe(true)
    expect(shortcuts()).toEqual(['Shift+Tab'])
    // Até a página nova avisar que carregou, o atalho não faz nada.
    press('Shift+Tab')
    expect(w.ignoreMouse).toBe(true)
    expect(ready()).toMatchObject({ snapshot: inCall, editing: false })
  })

  it('página do overlay caiu no meio da edição: janela nova, sem edição, até ficar pronta', async () => {
    await setup()
    sendState(inCall)
    showGame()
    press('Shift+Tab')
    const old = h.state.windows[0]
    h.state.appHandlers['render-process-gone'].forEach((fn) => fn({}, old.webContents))
    expect(old.destroyed).toBe(true)
    const w = h.state.windows[1]
    expect(w).toMatchObject({ visible: true, ignoreMouse: true })
    expect(shortcuts()).toEqual(['Shift+Tab'])
    press('Shift+Tab')
    expect(w.ignoreMouse).toBe(true)
    ready(w)
    press('Shift+Tab')
    expect(w.ignoreMouse).toBe(false)
  })

  it('registra o atalho configurado, não o Shift+Tab', async () => {
    await setup()
    sendState({ ...inCall, shortcut: 'Ctrl+Shift+O' })
    showGame()
    expect(shortcuts()).toEqual(['Ctrl+Shift+O'])
    press('Ctrl+Shift+O')
    expect(h.state.windows[0].ignoreMouse).toBe(false)
    expect(shortcuts()).toEqual(['Ctrl+Shift+O', 'Escape'])
  })

  it('trocar o atalho com o overlay à vista solta o velho e segura o novo', async () => {
    await setup()
    sendState(inCall)
    showGame()
    expect(shortcuts()).toEqual(['Shift+Tab'])
    sendState({ ...inCall, shortcut: 'Alt+F9' })
    expect(shortcuts()).toEqual(['Alt+F9'])
  })

  it('atalho inválido vindo do estado vira o padrão', async () => {
    await setup()
    sendState({ ...inCall, shortcut: 'O' })
    showGame()
    expect(shortcuts()).toEqual(['Shift+Tab'])
  })

  it('atalho ocupado por outro programa: avisa as configurações', async () => {
    h.state.shortcutsTaken = ['Shift+Tab']
    await setup()
    sendState(inCall)
    showGame()
    expect(mainWindow.sent).toContainEqual([
      'overlay:shortcut-status',
      { accelerator: 'Shift+Tab', taken: true }
    ])
  })

  it('atalho registrado: avisa que está livre', async () => {
    await setup()
    sendState(inCall)
    showGame()
    expect(mainWindow.sent).toContainEqual([
      'overlay:shortcut-status',
      { accelerator: 'Shift+Tab', taken: false }
    ])
  })

  it('configurações perguntam se um atalho está livre (sem ficar com ele)', async () => {
    h.state.shortcutsTaken = ['Ctrl+Alt+P']
    await setup()
    const check = (accel: unknown): unknown =>
      h.state.handlers['overlay:check-shortcut']({ sender: mainWindow.webContents }, accel)
    expect(check('Ctrl+Shift+O')).toEqual({ accelerator: 'Ctrl+Shift+O', taken: false })
    expect(shortcuts()).toEqual([])
    expect(check('ctrl+alt+p')).toEqual({ accelerator: 'Ctrl+Alt+P', taken: true })
    // Inválido: nem tenta registrar.
    expect(check('Tab')).toBeNull()
    // O que o overlay já segura conta como livre.
    sendState(inCall)
    showGame()
    expect(check('Shift+Tab')).toEqual({ accelerator: 'Shift+Tab', taken: false })
    expect(shortcuts()).toEqual(['Shift+Tab'])
  })
})

describe('overlay nativo (Windows)', () => {
  const helperSays = (line: string, i = 0): Promise<void> =>
    new Promise((resolve) => {
      h.state.helpers[i].stdout.write(line + '\n')
      setImmediate(resolve)
    })
  const lastState = (i = 0): Record<string, unknown> =>
    JSON.parse(h.state.helpers[i].written.at(-1) ?? 'null')

  it('com o helper no lugar: sobe a janela nativa na call e não abre o Chromium', async () => {
    h.state.helperExists = true
    await setup()
    sendState(inCall)
    expect(h.state.helpers).toHaveLength(1)
    h.state.onChange?.(game)
    expect(h.state.windows).toHaveLength(0)
    expect(lastState()).toMatchObject({ type: 'state', visible: true, game: 4242 })
    h.state.onChange?.(null)
    expect(lastState()).toEqual({ type: 'state', visible: false })
  })

  it('edição pelo atalho só depois do "ready" do helper; a posição volta para salvar', async () => {
    h.state.helperExists = true
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    press('Shift+Tab')
    expect(shortcuts()).toEqual(['Shift+Tab'])
    await helperSays('{"type":"ready"}')
    press('Shift+Tab')
    expect(shortcuts()).toEqual(['Escape', 'Shift+Tab'])
    expect(lastState()).toMatchObject({ editing: true })
    await helperSays('{"type":"layout","layout":{"position":{"x":0.5,"y":0.5},"scale":1}}')
    expect(mainWindow.sent).toContainEqual(['overlay:layout', { position: { x: 0.5, y: 0.5 }, scale: 1 }])
    press('Escape')
    expect(lastState()).toMatchObject({ editing: false })
  })

  it('helper que sai: cai na janela do Electron e não tenta o nativo de novo', async () => {
    h.state.helperExists = true
    await setup()
    sendState(inCall)
    h.state.onChange?.(game)
    h.state.helpers[0].handlers['exit'].forEach((fn) => fn(1))
    expect(h.state.windows).toHaveLength(1)
    expect(h.state.windows[0].visible).toBe(true)
    // Nova call: continua no Electron.
    sendState({ ...inCall, inCall: false })
    sendState(inCall)
    expect(h.state.helpers).toHaveLength(1)
  })

  it('fim da call fecha o helper', async () => {
    h.state.helperExists = true
    await setup()
    sendState(inCall)
    sendState({ ...inCall, inCall: false })
    expect(h.state.helpers[0].killed).toBe(true)
  })

  it('SALINHA_OVERLAY=electron força a janela antiga (comparação)', async () => {
    h.state.helperExists = true
    process.env.SALINHA_OVERLAY = 'electron'
    await setup()
    sendState(inCall)
    showGame()
    expect(h.state.helpers).toHaveLength(0)
    expect(h.state.windows).toHaveLength(1)
  })
})
