import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, Tray } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { launchedHidden, shouldHideOnClose, shouldNotify } from './windowPolicy'

// Modo segundo plano estilo Discord: bandeja, instância única, iniciar com o
// Windows e notificações nativas. Bandeja/fechar-esconde só no Windows.

interface CallState {
  inCall: boolean
  muted: boolean
}

interface NotifyPayload {
  title: string
  body: string
  route: string
  urgent?: boolean
}

let tray: Tray | null = null
// Notificações vivas: sem referência o GC do Windows as coleta e o clique some.
const activeNotifications = new Set<Notification>()
let quitting = false
let callState: CallState = { inCall: false, muted: false }
const callStateListeners = new Set<(state: CallState) => void>()

export function isInCall(): boolean {
  return callState.inCall
}

export function onCallStateChange(listener: (state: CallState) => void): void {
  callStateListeners.add(listener)
}

/** Daqui em diante fechar a janela fecha o app (ex.: instalar atualização). */
export function markQuitting(): void {
  quitting = true
}

const prefsPath = (): string => join(app.getPath('userData'), 'background.json')

function readPrefs(): { autostartInitialized?: boolean } {
  try {
    return JSON.parse(readFileSync(prefsPath(), 'utf8'))
  } catch {
    return {}
  }
}

function writePrefs(prefs: { autostartInitialized?: boolean }): void {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(prefsPath(), JSON.stringify(prefs))
  } catch {
    // sem onde gravar: só repete a configuração inicial no próximo boot
  }
}

// O portable roda de uma pasta temporária: um atalho de login para ele quebraria.
const autostartSupported = (): boolean =>
  process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE

function setAutostart(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}

/** "Iniciar com o Windows" vem ligado na primeira execução. */
function initAutostart(): void {
  if (!autostartSupported() || !app.isPackaged) return
  const prefs = readPrefs()
  if (prefs.autostartInitialized) return
  setAutostart(true)
  writePrefs({ ...prefs, autostartInitialized: true })
}

function showWindow(win: BrowserWindow | null): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function rebuildTrayMenu(getWindow: () => BrowserWindow | null): void {
  if (!tray) return
  tray.setToolTip(callState.inCall ? 'Concord — em chamada' : 'Concord')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Concord', click: () => showWindow(getWindow()) },
      ...(callState.inCall
        ? [
            {
              label: callState.muted ? 'Ativar microfone' : 'Silenciar microfone',
              click: () => getWindow()?.webContents.send('tray:toggle-mute')
            }
          ]
        : []),
      { type: 'separator' as const },
      { label: 'Sair do Concord', click: () => requestQuit(getWindow()) }
    ])
  )
}

/** Sair de verdade: o renderer encerra a chamada antes de o app fechar. */
function requestQuit(win: BrowserWindow | null): void {
  quitting = true
  if (!win || win.isDestroyed()) {
    app.quit()
    return
  }
  win.webContents.send('app:quit-requested')
  // Se o renderer não responder (travado), fecha mesmo assim.
  setTimeout(() => app.quit(), 1500)
}

/**
 * Garante uma única instância. Retorna false se já havia outra aberta (esta
 * deve encerrar); a outra recebe o foco.
 */
export function ensureSingleInstance(getWindow: () => BrowserWindow | null): boolean {
  if (!app.requestSingleInstanceLock()) return false
  app.on('second-instance', () => showWindow(getWindow()))
  return true
}

/** Deve a janela começar escondida (aberta pelo login do Windows)? */
export function startHidden(): boolean {
  return autostartSupported() && launchedHidden(process.argv)
}

export function setupBackground(getWindow: () => BrowserWindow | null, icon: string): void {
  initAutostart()

  app.on('before-quit', () => {
    quitting = true
  })

  if (process.platform === 'win32') {
    tray = new Tray(nativeImage.createFromPath(icon))
    tray.on('click', () => showWindow(getWindow()))
    rebuildTrayMenu(getWindow)
  }

  ipcMain.on('call:state', (_e, state: CallState) => {
    callState = state
    rebuildTrayMenu(getWindow)
    callStateListeners.forEach((listener) => listener(state))
  })

  ipcMain.on('app:quit', () => {
    quitting = true
    app.quit()
  })

  ipcMain.handle('settings:autostart', () =>
    autostartSupported() ? app.getLoginItemSettings().openAtLogin : null
  )
  ipcMain.handle('settings:set-autostart', (_e, enabled: boolean) => {
    if (!autostartSupported()) return null
    setAutostart(enabled)
    return enabled
  })

  ipcMain.on('notify', (_e, payload: NotifyPayload) => {
    const win = getWindow()
    if (!win || !Notification.isSupported()) return
    if (!shouldNotify({ visible: win.isVisible(), focused: win.isFocused() })) return
    const notification = new Notification({ title: payload.title, body: payload.body, icon })
    activeNotifications.add(notification)
    notification.on('click', () => {
      activeNotifications.delete(notification)
      showWindow(win)
      win.webContents.send('navigate', payload.route)
    })
    notification.on('close', () => activeNotifications.delete(notification))
    notification.show()
    if (payload.urgent) win.flashFrame(true)
  })
}

/** Liga o "fechar esconde na bandeja" na janela principal. */
export function attachCloseToTray(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (!shouldHideOnClose(process.platform, quitting)) return
    event.preventDefault()
    win.hide()
  })
  win.on('focus', () => win.flashFrame(false))
}
