import { BrowserWindow, ipcMain, session, shell } from 'electron'
import { findActivity, isAllowedActivityUrl } from '../../shared/activities'
import {
  activityPageScript,
  activityPermissionAllowed,
  activityWindowOptions,
  canNavigateActivity,
  createExternalOpenGate,
  createRoomTracker,
  isUserGestureInput,
  opensExternally
} from './activityPolicy'

// Atividades no desktop: o jogo abre numa janela própria (moldura normal), com
// sessão separada e nada do app exposto. Uma por vez; fechar a janela encerra
// a participação (o renderer principal é avisado por 'activity:closed').
// A sala em que o jogo está (URL da partida/time) vai para o renderer por
// 'activity:room'; se quem abriu for você, ela é compartilhada com a chamada.

let win: BrowserWindow | null = null
let current: string | null = null
// Último link carregado: pedir o mesmo de novo só traz a janela para a frente
// (recarregar tiraria a pessoa da sala).
let loadedUrl: string | null = null
const preparedSessions = new Set<string>()
/** Mundo isolado dos scripts da janela (não é o da página nem o do preload). */
const ACTIVITY_WORLD_ID = 1001

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
  // O jogo não precisa baixar nada; sem Safe Browsing, download é risco.
  ses.on('will-download', (event) => event.preventDefault())
}

function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : ''
  } catch {
    return ''
  }
}

function createActivityWindow(
  activityId: string,
  getMain: () => BrowserWindow | null
): BrowserWindow | null {
  const options = activityWindowOptions(activityId)
  const activity = findActivity(activityId)
  if (!options || !activity) return null
  prepareSession(activityId, activity.partition)

  // User agent padrão do Electron, sem disfarce. O Cloudflare Turnstile (a
  // verificação de segurança do Krunker) reconhece o Electron por outros sinais
  // da página: um user agent de "Chrome" puro não bate com eles e vira desafio
  // ("Security check failed"). E o webContents.setUserAgent nem chega ao iframe
  // do Turnstile (outra origem), que ficaria com um user agent diferente.
  const created = new BrowserWindow(options)
  const title = options.title ?? activity.name
  // O título fica "Krunker.io — Salinha" (a página tentaria trocar).
  created.on('page-title-updated', (event) => {
    event.preventDefault()
    created.setTitle(title)
  })
  created.once('ready-to-show', () => created.show())
  // Ajustes do jogo na página (mundo isolado; ver activityPageScript).
  created.webContents.on('dom-ready', () => {
    const script = activityPageScript(activityId, created.webContents.getURL())
    if (script) {
      void created.webContents
        .executeJavaScriptInIsolatedWorld(ACTIVITY_WORLD_ID, [{ code: script }])
        .catch(() => {})
    }
  })

  // Novas janelas (links, login social) vão para o navegador, como no app —
  // mas só logo depois de um clique/tecla da pessoa e no máximo uma a cada 3 s
  // (anúncio não abre abas sozinho).
  const gate = createExternalOpenGate()
  created.webContents.on('before-input-event', (_event, input) => {
    if (isUserGestureInput(input.type)) gate.recordInput(Date.now())
  })
  created.webContents.setWindowOpenHandler((details) => {
    if (opensExternally(details.url) && gate.allow(Date.now())) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })
  // A própria janela não sai do site do jogo: navegação de fora é bloqueada.
  created.webContents.on('will-navigate', (details) => {
    if (!details.isMainFrame || canNavigateActivity(activityId, details.url)) return
    details.preventDefault()
  })
  // Só o frame principal: iframes de anúncio/terceiros redirecionam à vontade.
  created.webContents.on('will-redirect', (details) => {
    if (!details.isMainFrame || canNavigateActivity(activityId, details.url)) return
    details.preventDefault()
  })

  // O jogo troca a própria URL ao entrar numa partida ou criar um time (history
  // API ou #hash): a sala vai para o renderer, que a compartilha se for o caso.
  const rooms = createRoomTracker(activityId)
  const reportRoom = (url: string): void => {
    const room = rooms.visit(url)
    const main = getMain()
    if (room && main && !main.isDestroyed())
      main.webContents.send('activity:room', activityId, room)
  }
  created.webContents.on('did-navigate', (_event, url) => reportRoom(url))
  created.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) reportRoom(url)
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
