import { app, shell, BrowserWindow, desktopCapturer, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { displayMediaStreams } from './displayMedia'

let mainWindow: BrowserWindow | null = null

// Picker de tela (Fase 3): o getDisplayMedia do renderer dispara este handler,
// que pede ao renderer para abrir o modal de seleção e resolve com a fonte
// escolhida via IPC (estilo Discord).
let pendingDisplayCallback:
  ((streams: { video?: Electron.DesktopCapturerSource; audio?: 'loopback' }) => void) | null = null
let pendingAudioRequested = false

function registerScreenShareHandlers(): void {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    pendingDisplayCallback = callback
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
    const callback = pendingDisplayCallback
    pendingDisplayCallback = null
    if (!callback) return
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
      const source = sources.find((s) => s.id === sourceId)
      if (source) {
        callback(displayMediaStreams(source, pendingAudioRequested, process.platform))
      } else {
        callback({})
      }
    } catch {
      callback({})
    }
  })

  ipcMain.on('screen-picker:cancel', () => {
    const callback = pendingDisplayCallback
    pendingDisplayCallback = null
    if (callback) callback({})
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
    title: 'Concord',
    backgroundColor: '#0f1120',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
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
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.concord.app')

  registerScreenShareHandlers()

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
