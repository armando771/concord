import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { OverlaySnapshot } from '../renderer/src/lib/overlayState'
import { normalizeOverlayLayout } from '../renderer/src/lib/overlayLayout'
import { appendLog } from './appLog'
import { startForegroundWatch, stopForegroundWatch } from './foregroundWatch'
import {
  OVERLAY_EDIT_SHORTCUT,
  OVERLAY_EXIT_SHORTCUT,
  overlayBounds,
  overlayShortcuts,
  shouldShowOverlay,
  shouldWatchForeground,
  type Foreground,
  type Rect
} from './overlayPolicy'

// Overlay de jogo: janela transparente, click-through e sem foco por cima do
// jogo em tela cheia em janela (nada é injetado no jogo). O renderer principal
// manda o estado da call; o helper diz qual janela está na frente.
//
// A janela cobre a área de trabalho do monitor do jogo e a lista é uma caixa lá
// dentro. Shift+Tab (só com o overlay à vista) liga o modo de edição: a janela
// passa a aceitar o mouse para arrastar/redimensionar a caixa. Continua sem foco
// (focusable: false = WS_EX_NOACTIVATE no Windows: recebe clique e arraste sem
// tirar o foco do jogo); por isso o Esc é um atalho global, não um keydown.

let snapshot: OverlaySnapshot | null = null
let foreground: Foreground = null
let win: BrowserWindow | null = null
// Saindo do app: um estado atrasado do renderer não pode subir o helper nem
// recriar a janela, senão o Electron fica esperando e não fecha.
let quitting = false
let visible = false
let editing = false
// A página do overlay desta janela já carregou e ouve 'overlay:editing'. Antes
// disso o atalho não liga a edição: seria uma tela inteira pegando cliques sem
// moldura nem dica.
let pageReady = false
// Atalhos globais pedidos agora → se o registro deu certo. Um que falhou
// (outro app segurando) só é tentado de novo depois de soltar.
const held = new Map<string, boolean>()

function log(message: string): void {
  appendLog('audio.log', `overlay: ${message}`)
}

function createOverlayWindow(): BrowserWindow {
  const overlay = new BrowserWindow({
    show: false,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    type: 'toolbar',
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  })
  // Cliques passam para o jogo; nível acima de janelas em tela cheia.
  overlay.setIgnoreMouseEvents(true)
  overlay.setAlwaysOnTop(true, 'screen-saver')
  // Fora do compartilhamento de tela (quem assiste não vê o overlay).
  overlay.setContentProtection(true)
  overlay.on('closed', () => {
    if (win === overlay) win = null
  })
  // Recarregou (ou navegou): a página nova não sabe da edição. Sai dela e volta o
  // click-through até a página avisar que está pronta.
  overlay.webContents.on('did-start-loading', () => {
    if (win !== overlay) return
    pageReady = false
    setEditing(false)
    applyShortcuts()
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlay.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
  } else {
    overlay.loadFile(join(__dirname, '../renderer/overlay.html'))
  }
  return overlay
}

/** Liga/desliga o modo de edição: fora dele, a janela sempre ignora o mouse. */
function setEditing(next: boolean): void {
  if (editing === next) return
  editing = next
  if (win) {
    win.setIgnoreMouseEvents(!next)
    win.webContents.send('overlay:editing', next)
  }
}

function hold(accelerator: string, wanted: boolean, onPress: () => void): void {
  if (wanted === held.has(accelerator)) return
  if (wanted) {
    const ok = globalShortcut.register(accelerator, onPress)
    held.set(accelerator, ok)
    if (!ok) log(`atalho ${accelerator} ocupado por outro app`)
  } else {
    if (held.get(accelerator)) globalShortcut.unregister(accelerator)
    held.delete(accelerator)
  }
}

/** Segura só os atalhos que a política pede agora (ver overlayShortcuts). */
function applyShortcuts(): void {
  const want = overlayShortcuts({ visible, editing, quitting })
  hold(OVERLAY_EDIT_SHORTCUT, want.toggleEdit, () => {
    if (quitting || !visible || !pageReady) return
    setEditing(!editing)
    applyShortcuts()
  })
  hold(OVERLAY_EXIT_SHORTCUT, want.exitEdit, () => {
    if (quitting) return
    setEditing(false)
    applyShortcuts()
  })
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

function sync(): void {
  if (quitting) return
  if (shouldWatchForeground(process.platform, snapshot)) {
    startForegroundWatch((next) => {
      foreground = next
      sync()
    })
  } else {
    stopForegroundWatch()
    foreground = null
    // Fora da call (ou desligado): libera o renderer do overlay.
    editing = false
    win?.destroy()
    win = null
  }

  if (shouldShowOverlay(process.platform, snapshot, foreground, process.pid) && foreground) {
    if (!win) {
      editing = false
      pageReady = false
      win = createOverlayWindow()
    }
    // O helper fala em pixels físicos; o Electron posiciona em DIP. A janela
    // cobre a área de trabalho desse monitor; a lista é posicionada pelo CSS.
    const display = screen.getDisplayMatching(screen.screenToDipRect(null, foreground.monitor))
    const bounds = overlayBounds(display.workArea)
    win.setBounds(bounds)
    // Monitores com escalas diferentes: o primeiro setBounds pode sair com a
    // escala do monitor antigo; o segundo acerta.
    const got = win.getBounds()
    if (got && !sameRect(got, bounds)) win.setBounds(bounds)
    win.setAlwaysOnTop(true, 'screen-saver')
    if (!win.isVisible()) win.showInactive()
    win.moveTop()
    visible = true
  } else {
    // Esconder (ou fim da call) sempre devolve o click-through.
    setEditing(false)
    win?.hide()
    visible = false
  }
  applyShortcuts()

  if (win) win.webContents.send('overlay:update', snapshot)
}

export function setupOverlay(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.on('overlay:state', (_event, next: OverlaySnapshot) => {
    snapshot = next
    sync()
  })
  // Página do overlay carregou (já ouvindo os eventos): último estado e se está
  // editando. Só a partir daqui o atalho liga a edição.
  ipcMain.handle('overlay:ready', (event) => {
    if (win && !quitting && event.sender === win.webContents) pageReady = true
    return { snapshot, editing }
  })
  // Página do overlay → posição/tamanho novos (fim do arraste). Quem salva é o
  // renderer principal (preferências do overlay), que manda de volta no estado.
  ipcMain.on('overlay:layout', (event, raw: unknown) => {
    if (quitting || !win || event.sender !== win.webContents) return
    getMainWindow()?.webContents.send('overlay:layout', normalizeOverlayLayout(raw))
  })
  app.on('render-process-gone', (_event, contents) => {
    // Renderer principal caiu: sem estado da call, o overlay some.
    if (contents === getMainWindow()?.webContents) {
      snapshot = null
      sync()
    } else if (win && contents === win.webContents) {
      editing = false
      pageReady = false
      win.destroy()
      win = null
      sync()
    }
  })
  app.on('before-quit', () => {
    quitting = true
    snapshot = null
    foreground = null
    visible = false
    editing = false
    pageReady = false
    applyShortcuts()
    stopForegroundWatch()
    win?.destroy()
    win = null
  })
}
