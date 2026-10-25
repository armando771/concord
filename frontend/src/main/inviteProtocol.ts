import { app, BrowserWindow, ipcMain } from 'electron'
import { resolve } from 'path'
import { INVITE_PROTOCOL } from '../renderer/src/lib/inviteLink'
import { PendingInvite } from './inviteDeepLink'

// Links salinha://convite/<código>: o site abre o app no convite. Só o
// convite passa (inviteLink.parseInviteDeepLink); qualquer outro salinha://
// é ignorado.

const pending = new PendingInvite()

/**
 * Registra o salinha:// no sistema. O instalador (build/installer.nsh) já
 * registra; aqui cobre quem instalou antes disso. O portable roda de uma
 * pasta temporária: registrar apontaria para um .exe que some.
 */
function registerProtocol(): void {
  if (process.env.PORTABLE_EXECUTABLE_FILE) return
  if (app.isPackaged) {
    if (process.platform === 'win32' || process.platform === 'darwin') {
      app.setAsDefaultProtocolClient(INVITE_PROTOCOL)
    }
    return
  }
  // Dev no Windows: o electron.exe precisa do caminho do app nos args.
  if (process.platform === 'win32' && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(INVITE_PROTOCOL, process.execPath, [resolve(process.argv[1])])
  }
}

function notify(getWindow: () => BrowserWindow | null): void {
  const win = getWindow()
  if (win && !win.isDestroyed()) win.webContents.send('invite:open')
}

/** Args de uma segunda instância (o app já estava aberto e o link chegou). */
export function handleInviteArgs(
  argv: readonly string[],
  getWindow: () => BrowserWindow | null
): void {
  if (pending.offerArgs(argv)) notify(getWindow)
}

/** Chamar antes do whenReady: guarda o convite da partida a frio. */
export function setupInviteProtocol(getWindow: () => BrowserWindow | null): void {
  registerProtocol()
  pending.offerArgs(process.argv)

  // macOS entrega o link por evento, não por args.
  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (pending.offerUrl(url)) notify(getWindow)
  })

  ipcMain.handle('invite:take-pending', () => pending.take())
}
