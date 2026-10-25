import { app, shell, BrowserWindow, desktopCapturer, ipcMain, Menu, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { displayAudioMode } from './displayMedia'
import { PendingDisplayRequest } from './displayPicker'
import { attachCloseToTray, ensureSingleInstance, setupBackground, startHidden } from './background'
import { setupUpdater } from './updater'
import { setupOverlay } from './overlay'
import {
  audioLogPath,
  hwndFromSourceId,
  logAudio,
  registerScreenAudio,
  startWindowAudio,
  stopWindowAudio
} from './screenAudio'

let mainWindow: BrowserWindow | null = null

// Picker de tela (Fase 3): o getDisplayMedia do renderer dispara este handler,
// que pede ao renderer para abrir o modal de seleção e resolve com a fonte
// escolhida via IPC (estilo Discord).
const pendingDisplay = new PendingDisplayRequest((err) =>
  logAudio(`recusar o compartilhamento falhou: ${String(err)}`)
)
let pendingAudioRequested = false

function registerScreenShareHandlers(): void {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    pendingDisplay.hold(callback)
    pendingAudioRequested = request.audioRequested
    mainWindow?.webContents.send('screen-picker:show')
  })

  ipcMain.handle('screen-picker:sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 480, height: 270 },
      fetchWindowIcons: true
    })
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon?.toDataURL() ?? null,
      displayId: source.display_id
    }))
  })

  ipcMain.on('screen-picker:select', async (_event, sourceId: string) => {
    const callback = pendingDisplay.take()
    if (!callback) return
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
      const source = sources.find((s) => s.id === sourceId)
      // Cada escolha começa do zero: nada do compartilhamento anterior.
      stopWindowAudio()
      if (!source) {
        logAudio(`fonte ${sourceId} não encontrada`)
        callback(null)
        return
      }
      const hwnd = hwndFromSourceId(source.id)
      let windowAudioOk = false
      if (hwnd && pendingAudioRequested && process.platform === 'win32' && mainWindow) {
        windowAudioOk = await startWindowAudio(hwnd, mainWindow.webContents)
      }
      const mode = displayAudioMode({
        sourceId: source.id,
        audioRequested: pendingAudioRequested,
        platform: process.platform,
        windowAudioOk
      })
      logAudio(`compartilhando "${source.name}" (${source.id}): som = ${mode}`)
      if (mode === 'none' && source.id.startsWith('window:') && pendingAudioRequested) {
        mainWindow?.webContents.send('screen-audio:fallback', audioLogPath())
      }
      callback(mode === 'system' ? { video: source, audio: 'loopback' } : { video: source })
    } catch (err) {
      logAudio(`falha ao compartilhar ${sourceId}: ${String(err)}`)
      callback(null)
    }
  })

  ipcMain.on('screen-picker:cancel', () => {
    stopWindowAudio()
    pendingDisplay.deny()
  })
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Salinha',
    backgroundColor: '#0f1120',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    // Aberto pelo "Iniciar com o Windows": fica só na bandeja.
    if (!startHidden()) mainWindow?.show()
  })
  attachCloseToTray(mainWindow)

  mainWindow.on('closed', () => {
    pendingDisplay.deny()
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Só uma instância: abrir de novo traz a janela existente.
// app.exit (não quit): sai na hora, sem criar janela/bandeja duplicadas.
// O app se chamava Concord: a pasta de dados continua a mesma para ninguém
// perder o login nem as configurações (antes do lock, que mora nela).
app.setPath('userData', join(app.getPath('appData'), 'Concord'))
if (!ensureSingleInstance(() => mainWindow)) app.exit(0)

app.whenReady().then(() => {
  // Set app user model id for windows. Mantém o id do Concord (nome antigo):
  // é o que liga notificações, atalho de login e instalação ao mesmo app.
  electronApp.setAppUserModelId('com.concord.app')
  // Sem a barra "File Edit View Window" padrão do Electron (aparecia no Alt).
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)

  registerScreenShareHandlers()
  registerScreenAudio()
  setupBackground(() => mainWindow, icon)
  setupOverlay(() => mainWindow)
  setupUpdater(() => mainWindow, {
    feedUrl: __CONCORD_UPDATE_URL__,
    publicKeyPem: __CONCORD_UPDATE_PUBKEY__
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
