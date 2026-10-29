import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import type { OverlaySnapshot } from '../../renderer/src/features/overlay/lib/overlayState'
import { normalizeOverlayShortcut, parseAccelerator } from '../../renderer/src/features/overlay/lib/overlayShortcut'
import { appendLog } from '../app/appLog'
import { startForegroundWatch, stopForegroundWatch } from '../activity/foregroundWatch'
import {
  OVERLAY_EXIT_SHORTCUT,
  overlayShortcuts,
  shouldShowOverlay,
  shouldWatchForeground,
  type Foreground
} from './overlayPolicy'
import { setupElectronOverlay } from './electronOverlay'
import { createNativeOverlay } from './nativeOverlay'
import { nativeHelperExists, overlayAvatarStore, startNativeHelper } from './nativeHelper'
import { chooseOverlayRenderer, overlayRendererFlag } from './overlayRenderer'
import type { OverlayHost, OverlaySurface } from './overlaySurface'

// Overlay de jogo: a lista de quem está na call por cima do jogo em tela cheia
// em janela. O renderer principal manda o estado da call; o helper diz qual
// janela está na frente; a superfície (overlaySurface.ts) desenha: no Windows
// a janela nativa do helper (sem Chromium por cima do jogo), senão — ou se o
// helper falhar — a janela do Electron.
//
// O atalho configurado (padrão Shift+Tab; só com o overlay à vista) liga o
// modo de edição: a superfície passa a aceitar o mouse para arrastar e
// redimensionar a lista, sem tirar o foco do jogo; por isso o Esc é um atalho
// global, não um keydown.

let snapshot: OverlaySnapshot | null = null
let foreground: Foreground = null
// Superfície da call atual (criada ao entrar com o overlay ligado).
let surface: OverlaySurface | null = null
let electron: OverlaySurface
// O nativo falhou nesta sessão: até reabrir o app, só o Electron.
let nativeFailed = false
// Saindo do app: um estado atrasado do renderer não pode subir o helper nem
// recriar a janela, senão o Electron fica esperando e não fecha.
let quitting = false
let visible = false
let editing = false
// Atalhos globais pedidos agora → se o registro deu certo. Um que falhou
// (outro app segurando) só é tentado de novo depois de soltar.
const held = new Map<string, boolean>()
let getMain: () => BrowserWindow | null = () => null

function log(message: string): void {
  appendLog('audio.log', `overlay: ${message}`)
}

function setEditing(next: boolean): void {
  if (editing === next) return
  editing = next
  surface?.setEditing(next)
}

function tryRegister(accelerator: string, onPress: () => void): boolean {
  try {
    return globalShortcut.register(accelerator, onPress)
  } catch {
    return false
  }
}

function release(accelerator: string): void {
  if (held.get(accelerator)) globalShortcut.unregister(accelerator)
  held.delete(accelerator)
}

function toggleEdit(): void {
  if (quitting || !visible || !surface?.canEdit()) return
  setEditing(!editing)
  applyShortcuts()
}

function exitEdit(): void {
  if (quitting) return
  setEditing(false)
  applyShortcuts()
}

/**
 * Segura só os atalhos que a política pede agora (ver overlayShortcuts): o de
 * edição configurado nas preferências e, editando, o Esc. Troca de atalho com
 * o overlay à vista solta o velho. O resultado do de edição vai para as
 * configurações ("Atalho em uso por outro programa").
 */
function applyShortcuts(): void {
  const want = overlayShortcuts({ visible, editing, quitting })
  const editKey = normalizeOverlayShortcut(snapshot?.shortcut)
  const wanted = new Map<string, () => void>()
  if (want.toggleEdit) wanted.set(editKey, toggleEdit)
  if (want.exitEdit) wanted.set(OVERLAY_EXIT_SHORTCUT, exitEdit)
  for (const accelerator of [...held.keys()]) {
    if (!wanted.has(accelerator)) release(accelerator)
  }
  for (const [accelerator, onPress] of wanted) {
    if (held.has(accelerator)) continue
    const ok = tryRegister(accelerator, onPress)
    held.set(accelerator, ok)
    if (!ok) log(`atalho ${accelerator} ocupado por outro programa`)
    if (accelerator === editKey) {
      getMain()?.webContents.send('overlay:shortcut-status', { accelerator, taken: !ok })
    }
  }
}

/**
 * Janela nativa quando dá (Windows, helper no lugar, sem `--overlay=electron`
 * e sem falha antes); senão, ou se ela nem sobe, a do Electron.
 */
function createSurface(): OverlaySurface {
  const renderer = chooseOverlayRenderer({
    platform: process.platform,
    helperExists: process.platform === 'win32' && nativeHelperExists(),
    forced: overlayRendererFlag(process.argv, process.env),
    nativeFailed
  })
  if (renderer === 'native') {
    try {
      const native = createNativeOverlay(host, {
        start: startNativeHelper,
        avatars: overlayAvatarStore(),
        log
      })
      log('usando a janela nativa')
      return native
    } catch (err) {
      nativeFailed = true
      log(`janela nativa não iniciou (${String(err)}); usando a do Electron`)
    }
  }
  return electron
}

function sync(): void {
  if (quitting) return
  if (shouldWatchForeground(process.platform, snapshot)) {
    startForegroundWatch((next) => {
      foreground = next
      sync()
    })
    surface ??= createSurface()
  } else {
    stopForegroundWatch()
    foreground = null
    editing = false
    surface?.destroy()
    surface = null
  }

  if (shouldShowOverlay(process.platform, snapshot, foreground, process.pid) && foreground && surface) {
    surface.show(foreground)
    visible = true
  } else {
    // Esconder (ou fim da call) sempre devolve o click-through.
    setEditing(false)
    surface?.hide()
    visible = false
  }
  applyShortcuts()
}

const host: OverlayHost = {
  snapshot: () => snapshot,
  editing: () => editing,
  stopEditing: exitEdit,
  saveLayout: (layout) => getMain()?.webContents.send('overlay:layout', layout),
  lost: () => {
    editing = false
    sync()
  },
  failed: (reason) => {
    log(`janela nativa falhou (${reason}); usando a do Electron`)
    nativeFailed = true
    editing = false
    surface = null
    sync()
  }
}

export function setupOverlay(getMainWindow: () => BrowserWindow | null): void {
  getMain = getMainWindow
  electron = setupElectronOverlay(host)
  ipcMain.on('overlay:state', (_event, next: OverlaySnapshot) => {
    snapshot = next
    surface?.onState()
    sync()
  })
  // Configurações: o atalho está livre? Se o overlay já segura, sim; senão
  // registra e solta na hora (só para saber se outro programa tem).
  ipcMain.handle('overlay:check-shortcut', (event, raw: unknown) => {
    if (quitting || event.sender !== getMainWindow()?.webContents) return null
    const parsed = parseAccelerator(raw as string)
    if (!parsed.ok) return null
    const { accelerator } = parsed
    if (held.has(accelerator)) return { accelerator, taken: !held.get(accelerator) }
    const ok = tryRegister(accelerator, () => {})
    if (ok) globalShortcut.unregister(accelerator)
    return { accelerator, taken: !ok }
  })
  app.on('render-process-gone', (_event, contents) => {
    // Renderer principal caiu: sem estado da call, o overlay some.
    if (contents === getMainWindow()?.webContents) {
      snapshot = null
      sync()
    }
  })
  app.on('before-quit', () => {
    quitting = true
    snapshot = null
    foreground = null
    visible = false
    editing = false
    applyShortcuts()
    stopForegroundWatch()
    surface?.destroy()
    surface = null
  })
}
