import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { findActivity, isAllowedActivityUrl } from '../shared/activities'
import {
  activityPermissionAllowed,
  activityUserAgent,
  activityWindowOptions,
  canNavigateActivity,
  opensExternally
} from './activityPolicy'

// Atividades no desktop: o jogo abre numa janela própria (moldura normal), com
// sessão separada e nada do app exposto. Uma por vez; fechar a janela encerra
// a participação (o renderer principal é avisado por 'activity:closed').

let win: BrowserWindow | null = null
let current: string | null = null
// Último link carregado: pedir o mesmo de novo só traz a janela para a frente
// (recarregar tiraria a pessoa da sala).
let loadedUrl: string | null = null
const preparedSessions = new Set<string>()

function prepareSession(activityId: string, partition: string): void {
  if (preparedSessions.has(partition)) return
  preparedSessions.add(partition)
  const ses = session.fromPartition(partition)
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    callback(activityPermissionAllowed(activityId, permission, originOf(details.requestingUrl)))
  })
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) =>
    activityPermissionAllowed(activityId, permission, requestingOrigin)
  )
}

function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : ''
  } catch {
    return ''
  }
}

function openExternal(url: string): void {
  if (opensExternally(url)) void shell.openExternal(url)
}

function createActivityWindow(
  activityId: string,
  getMain: () => BrowserWindow | null
): BrowserWindow | null {
  const options = activityWindowOptions(activityId)
  const activity = findActivity(activityId)
  if (!options || !activity) return null
  prepareSession(activityId, activity.partition)

  const created = new BrowserWindow(options)
  created.webContents.setUserAgent(activityUserAgent(app.userAgentFallback))
  const title = options.title ?? activity.name
  // O título fica "Krunker.io — Salinha" (a página tentaria trocar).
  created.on('page-title-updated', (event) => {
    event.preventDefault()
    created.setTitle(title)
  })
  created.once('ready-to-show', () => created.show())

  // Novas janelas (links, login social) vão para o navegador, como no app.
  created.webContents.setWindowOpenHandler((details) => {
    openExternal(details.url)
    return { action: 'deny' }
  })
  // A própria janela não sai do site do jogo.
  created.webContents.on('will-navigate', (event, url) => {
    if (canNavigateActivity(activityId, url)) return
    event.preventDefault()
    openExternal(url)
  })
  created.webContents.on('will-redirect', (event, url) => {
    if (canNavigateActivity(activityId, url)) return
    event.preventDefault()
  })

  created.on('closed', () => {
    if (win === created) {
      win = null
      current = null
      loadedUrl = null
    }
    const main = getMain()
    if (main && !main.isDestroyed()) main.webContents.send('activity:closed', activityId)
  })
  return created
}

export function openActivity(
  activityId: string,
  url: string,
  getMain: () => BrowserWindow | null
): boolean {
  if (!isAllowedActivityUrl(activityId, url)) return false
  if (win && !win.isDestroyed() && current !== activityId) {
    win.close()
    win = null
  }
  if (!win || win.isDestroyed()) {
    win = createActivityWindow(activityId, getMain)
    if (!win) return false
    current = activityId
  } else if (win.isMinimized()) {
    win.restore()
  }
  if (loadedUrl !== url) {
    loadedUrl = url
    void win.loadURL(url)
  }
  win.focus()
  return true
}

export function closeActivity(): void {
  if (win && !win.isDestroyed()) win.close()
}

export function setupActivities(getMain: () => BrowserWindow | null): void {
  const fromMain = (sender: Electron.WebContents): boolean => {
    const main = getMain()
    return !!main && !main.isDestroyed() && sender === main.webContents
  }
  ipcMain.handle('activity:open', (event, activityId: unknown, url: unknown) => {
    if (!fromMain(event.sender) || typeof activityId !== 'string' || typeof url !== 'string') {
      return false
    }
    return openActivity(activityId, url, getMain)
  })
  ipcMain.on('activity:close', (event) => {
    if (fromMain(event.sender)) closeActivity()
  })
}
