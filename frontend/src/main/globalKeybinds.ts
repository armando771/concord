import { app, globalShortcut, ipcMain, type BrowserWindow } from 'electron'
import {
  isValidBinding,
  mouseButtonFromHook,
  mouseButtonOf,
  toElectronAccelerator
} from '../renderer/src/lib/keybinds'
import { appendLog } from './appLog'

// Atalhos de voz que valem com o app em segundo plano. Teclado: globalShortcut
// do Electron. Botão do mouse: hook global (uiohook-napi), ligado só enquanto
// existir algum atalho de mouse. O renderer manda a lista e escuta 'keybinds:fire'.

/** Ações que podem ser globais (ids de lib/shortcuts com canBeGlobal). */
const GLOBAL_IDS = new Set(['toggleMute', 'toggleDeafen'])

interface Wanted {
  id: string
  binding: string
}

interface MouseHook {
  on: (event: 'mousedown', listener: (e: { button: unknown }) => void) => void
  off: (event: 'mousedown', listener: (e: { button: unknown }) => void) => void
  start: () => void
  stop: () => void
}

let getMain: () => BrowserWindow | null = () => null
let wanted: Wanted[] = []
let suspended = false
let quitting = false
let registered: string[] = []
/** MouseEvent.button → ação. */
const mouseActions = new Map<number, string>()
let hook: MouseHook | null = null
let hookRunning = false

function parseWanted(raw: unknown): Wanted[] {
  if (!Array.isArray(raw)) return []
  const out: Wanted[] = []
  for (const item of raw.slice(0, GLOBAL_IDS.size)) {
    const { id, binding } = (item ?? {}) as { id?: unknown; binding?: unknown }
    if (typeof id === 'string' && GLOBAL_IDS.has(id) && isValidBinding(binding)) {
      out.push({ id, binding })
    }
  }
  return out
}

function fire(id: string): void {
  if (quitting) return
  getMain()?.webContents.send('keybinds:fire', id)
}

const onMouseDown = (e: { button: unknown }): void => {
  const button = typeof e.button === 'number' ? mouseButtonFromHook(e.button) : null
  const id = button === null ? undefined : mouseActions.get(button)
  if (id) fire(id)
}

async function startHook(): Promise<boolean> {
  if (hookRunning) return true
  try {
    if (!hook) {
      const mod = (await import('uiohook-napi')) as unknown as { uIOhook: MouseHook }
      hook = mod.uIOhook
    }
    hook.on('mousedown', onMouseDown)
    hook.start()
    hookRunning = true
    return true
  } catch (err) {
    appendLog('audio.log', `keybinds: hook de mouse indisponível: ${String(err)}`)
    return false
  }
}

function stopHook(): void {
  if (!hook || !hookRunning) return
  hookRunning = false
  try {
    hook.off('mousedown', onMouseDown)
    hook.stop()
  } catch {
    // Já parado.
  }
}

function releaseKeyboard(): void {
  for (const accelerator of registered) {
    try {
      globalShortcut.unregister(accelerator)
    } catch {
      // Não estava registrado.
    }
  }
  registered = []
}

/** Aplica a lista pedida e diz, por ação, se ficou valendo. */
async function apply(): Promise<Record<string, boolean>> {
  releaseKeyboard()
  mouseActions.clear()
  const result: Record<string, boolean> = {}
  if (suspended || quitting) {
    stopHook()
    return result
  }

  for (const { id, binding } of wanted) {
    const button = mouseButtonOf(binding)
    if (button !== null) {
      mouseActions.set(button, id)
      continue
    }
    const accelerator = toElectronAccelerator(binding)
    let ok = false
    if (accelerator) {
      try {
        ok = globalShortcut.register(accelerator, () => fire(id))
      } catch {
        ok = false
      }
    }
    if (ok && accelerator) registered.push(accelerator)
    result[id] = ok
  }

  if (mouseActions.size > 0) {
    const ok = await startHook()
    for (const id of mouseActions.values()) result[id] = ok
  } else {
    stopHook()
  }
  return result
}

export function setupGlobalKeybinds(getMainWindow: () => BrowserWindow | null): void {
  getMain = getMainWindow
  ipcMain.handle('keybinds:set-global', async (event, raw: unknown) => {
    if (quitting || event.sender !== getMainWindow()?.webContents) return {}
    wanted = parseWanted(raw)
    return apply()
  })
  // Gravando um atalho nas configurações: soltar tudo para a tecla chegar na página.
  ipcMain.on('keybinds:suspend', (event, on: unknown) => {
    if (quitting || event.sender !== getMainWindow()?.webContents) return
    suspended = on === true
    void apply().then((result) => {
      if (!suspended) getMainWindow()?.webContents.send('keybinds:status', result)
    })
  })
  app.on('before-quit', () => {
    quitting = true
    releaseKeyboard()
    stopHook()
  })
}
