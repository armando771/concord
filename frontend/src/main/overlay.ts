import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { OverlaySnapshot } from '../renderer/src/lib/overlayState'
import { startForegroundWatch, stopForegroundWatch } from './foregroundWatch'
import {
  overlayBounds,
  shouldShowOverlay,
  shouldWatchForeground,
  type Foreground
} from './overlayPolicy'

// Overlay de jogo: janela transparente, click-through e sem foco por cima do
// jogo em tela cheia em janela (nada é injetado no jogo). O renderer principal
// manda o estado da call; o helper diz qual janela está na frente.

let snapshot: OverlaySnapshot | null = null
let foreground: Foreground = null
let win: BrowserWindow | null = null

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
  overlay.on('closed', () => {
    if (win === overlay) win = null
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlay.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
  } else {
    overlay.loadFile(join(__dirname, '../renderer/overlay.html'))
  }
  return overlay
}

function sync(): void {
  if (shouldWatchForeground(process.platform, snapshot)) {
    startForegroundWatch((next) => {
      foreground = next
      sync()
    })
  } else {
    stopForegroundWatch()
    foreground = null
    // Fora da call (ou desligado): libera o renderer do overlay.
    win?.destroy()
    win = null
  }

  if (shouldShowOverlay(process.platform, snapshot, foreground, process.pid) && foreground) {
    win ??= createOverlayWindow()
    // O helper fala em pixels físicos; o Electron posiciona em DIP.
    const dip = screen.getDisplayMatching(screen.screenToDipRect(null, foreground.monitor)).bounds
    win.setBounds(overlayBounds(dip))
    win.setAlwaysOnTop(true, 'screen-saver')
    if (!win.isVisible()) win.showInactive()
    win.moveTop()
  } else {
    win?.hide()
  }

  if (win) win.webContents.send('overlay:update', snapshot)
}

export function setupOverlay(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.on('overlay:state', (_event, next: OverlaySnapshot) => {
    snapshot = next
    sync()
  })
  ipcMain.handle('overlay:current', () => snapshot)
  app.on('render-process-gone', (_event, contents) => {
    // Renderer principal caiu: sem estado da call, o overlay some.
    if (contents === getMainWindow()?.webContents) {
      snapshot = null
      sync()
    } else if (win && contents === win.webContents) {
      win.destroy()
      win = null
      sync()
    }
  })
  app.on('before-quit', stopForegroundWatch)
}
