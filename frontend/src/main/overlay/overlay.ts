import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { OverlaySnapshot } from '../../renderer/src/features/overlay/lib/overlayState'
import {
  normalizeOverlayLayout,
  settleOverlayDraft,
  shownOverlayLayout,
  type OverlayDraft,
  type OverlayLayout,
  type OverlaySize
} from '../../renderer/src/features/overlay/lib/overlayLayout'
import { normalizeOverlayShortcut, parseAccelerator } from '../../renderer/src/features/overlay/lib/overlayShortcut'
import { appendLog } from '../app/appLog'
import { startForegroundWatch, stopForegroundWatch } from '../activity/foregroundWatch'
import {
  OVERLAY_EXIT_SHORTCUT,
  overlayFrame,
  overlayShortcuts,
  overlayWindowRect,
  shouldShowOverlay,
  shouldWatchForeground,
  type Foreground,
  type OverlayFrame,
  type Rect
} from './overlayPolicy'

// Overlay de jogo: janela transparente, click-through e sem foco por cima do
// jogo em tela cheia em janela (nada é injetado no jogo). O renderer principal
// manda o estado da call; o helper diz qual janela está na frente.
//
// A lista é uma caixa posicionada pelo CSS dentro da área de trabalho do
// monitor do jogo. A janela fica só em volta dela (a página mede e avisa o
// tamanho) e cresce para a área inteira só no modo de edição. O atalho
// configurado (padrão Shift+Tab; só com o overlay à vista) liga esse modo: a
// janela passa a aceitar o mouse para arrastar/redimensionar a caixa. Continua
// sem foco (focusable: false = WS_EX_NOACTIVATE no Windows: recebe clique e
// arraste sem tirar o foco do jogo); por isso o Esc é um atalho global, não um
// keydown. Jogos que leem o mouse por Raw Input continuam recebendo movimento e
// cliques mesmo com a janela por cima.

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
// Área de trabalho do monitor do jogo (DIP), tamanho da lista medido pela página,
// último arraste vindo da página (até o salvo chegar) e o que já foi aplicado.
let workArea: Rect | null = null
let box: OverlaySize | null = null
let pageDraft: OverlayDraft | null = null
let placed: Rect | null = null
let frame: OverlayFrame | null = null
// Atalhos globais pedidos agora → se o registro deu certo. Um que falhou
// (outro app segurando) só é tentado de novo depois de soltar.
const held = new Map<string, boolean>()
let getMain: () => BrowserWindow | null = () => null

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
    box = null
    setEditing(false)
    placeWindow()
    applyShortcuts()
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlay.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
  } else {
    overlay.loadFile(join(__dirname, '../../renderer/overlay.html'))
  }
  return overlay
}

function savedLayout(): OverlayLayout {
  return normalizeOverlayLayout(snapshot?.layout)
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/**
 * Janela no lugar da lista (ou na área inteira, editando). Só mexe quando o
 * retângulo muda: o estado chega a cada fala, e cada setBounds custa um
 * SetWindowPos e um relayout da página.
 */
function placeWindow(): void {
  if (!win || !workArea) return
  const rect = overlayWindowRect(
    workArea,
    shownOverlayLayout(savedLayout(), pageDraft),
    box,
    editing
  )
  if (!placed || !sameRect(placed, rect)) {
    win.setBounds(rect)
    // Monitores com escalas diferentes: o primeiro setBounds pode sair com a
    // escala do monitor antigo; o segundo acerta.
    const got = win.getBounds()
    if (got && !sameRect(got, rect)) win.setBounds(rect)
    placed = rect
  }
  const next = overlayFrame(workArea, rect)
  if (
    !frame ||
    frame.area.width !== next.area.width ||
    frame.area.height !== next.area.height ||
    frame.origin.x !== next.origin.x ||
    frame.origin.y !== next.origin.y
  ) {
    frame = next
    win.webContents.send('overlay:frame', next)
  }
}

/**
 * Liga/desliga o modo de edição: fora dele, a janela sempre ignora o mouse.
 * Entrando, a janela cresce antes de pegar o mouse; saindo, solta o mouse antes
 * de encolher.
 */
function setEditing(next: boolean): void {
  if (editing === next) return
  editing = next
  if (!next) win?.setIgnoreMouseEvents(true)
  placeWindow()
  if (win) {
    if (next) win.setIgnoreMouseEvents(false)
    win.webContents.send('overlay:editing', next)
  }
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
  if (quitting || !visible || !pageReady) return
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
      box = null
      placed = null
      frame = null
      win = createOverlayWindow()
    }
    // O helper fala em pixels físicos; o Electron posiciona em DIP.
    const display = screen.getDisplayMatching(screen.screenToDipRect(null, foreground.monitor))
    workArea = display.workArea
    placeWindow()
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
  getMain = getMainWindow
  ipcMain.on('overlay:state', (_event, next: OverlaySnapshot) => {
    snapshot = next
    pageDraft = settleOverlayDraft(savedLayout(), pageDraft)
    sync()
  })
  // Página do overlay carregou (já ouvindo os eventos): último estado e se está
  // editando. Só a partir daqui o atalho liga a edição.
  ipcMain.handle('overlay:ready', (event) => {
    if (win && !quitting && event.sender === win.webContents) pageReady = true
    return { snapshot, editing, frame }
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
  // Página do overlay → tamanho da lista (muda com a escala e com quem entra/sai).
  ipcMain.on('overlay:box', (event, raw: unknown) => {
    if (quitting || !win || event.sender !== win.webContents) return
    const size = raw as { width?: unknown; height?: unknown } | null
    const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
    if (!size || !ok(size.width) || !ok(size.height)) return
    box = { width: Math.ceil(size.width), height: Math.ceil(size.height) }
    placeWindow()
  })
  // Página do overlay → posição/tamanho novos (fim do arraste). Quem salva é o
  // renderer principal (preferências do overlay), que manda de volta no estado.
  ipcMain.on('overlay:layout', (event, raw: unknown) => {
    if (quitting || !win || event.sender !== win.webContents) return
    const layout = normalizeOverlayLayout(raw)
    // A janela já vai para o lugar novo; o salvo chega depois pelo estado.
    pageDraft = { layout, base: savedLayout() }
    placeWindow()
    getMainWindow()?.webContents.send('overlay:layout', layout)
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
