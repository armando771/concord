import { app, BrowserWindow, ipcMain, net } from 'electron'
import { autoUpdater, type UpdateDownloadedEvent } from 'electron-updater'
import { readFile, rm, writeFile } from 'fs/promises'
import { readFileSync } from 'fs'
import { basename, join } from 'path'
import { isInCall, markQuitting, onCallStateChange } from './background'
import { canDownloadUpdate, installOnStartup } from './updatePolicy'
import { verifyInstaller } from './updateSignature'

// Atualização automática servida pelo próprio servidor do Concord
// (`<servidor>/updates/`). O instalador só é aceito com a assinatura Ed25519
// do dono (chave pública embutida no build).

const CHECK_INTERVAL_MS = 30 * 60_000

interface UpdaterConfig {
  /** ex.: http://abc.ply.gg:1234/updates/ */
  feedUrl: string
  publicKeyPem: string
}

const startedAt = Date.now()

// Versão já baixada e verificada (sobrevive ao reinício do app): só ela pode
// ser instalada sozinha ao abrir.
const verifiedPath = (): string => join(app.getPath('userData'), 'update-verified.json')

function readVerifiedVersion(): string | null {
  try {
    return (
      (JSON.parse(readFileSync(verifiedPath(), 'utf8')) as { version?: string }).version ?? null
    )
  } catch {
    return null
  }
}

function saveVerifiedVersion(version: string): void {
  void writeFile(verifiedPath(), JSON.stringify({ version })).catch(() => {})
}
let pendingDownload = false
let downloading = false
let readyVersion: string | null = null

function install(): void {
  markQuitting()
  // silencioso e abre o app de novo ao terminar
  autoUpdater.quitAndInstall(true, true)
}

async function fetchSignature(feedUrl: string, file: string): Promise<string> {
  const response = await net.fetch(new URL(`${encodeURIComponent(file)}.sig`, feedUrl).toString())
  if (!response.ok) throw new Error(`assinatura não encontrada (${response.status})`)
  return response.text()
}

function startDownload(): void {
  if (downloading || readyVersion) return
  if (!canDownloadUpdate(isInCall())) {
    pendingDownload = true
    return
  }
  pendingDownload = false
  downloading = true
  autoUpdater.downloadUpdate().catch((err) => {
    downloading = false
    console.error('[update] download falhou:', err)
  })
}

export function setupUpdater(getWindow: () => BrowserWindow | null, config: UpdaterConfig): void {
  ipcMain.handle('update:status', () => readyVersion)
  ipcMain.on('update:install', () => {
    if (readyVersion) install()
  })

  // Sem endereço ou sem chave (build de desenvolvimento): não atualiza.
  if (!app.isPackaged || !config.feedUrl || !config.publicKeyPem) return

  autoUpdater.setFeedURL({ provider: 'generic', url: config.feedUrl })
  autoUpdater.autoDownload = false
  // A instalação passa pela verificação da assinatura — nunca automática.
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', startDownload)
  autoUpdater.on('error', (err) => {
    downloading = false
    console.error('[update] erro:', err)
  })
  autoUpdater.on('update-downloaded', async (event: UpdateDownloadedEvent) => {
    downloading = false
    try {
      const [data, signature] = await Promise.all([
        readFile(event.downloadedFile),
        fetchSignature(config.feedUrl, basename(event.downloadedFile))
      ])
      if (!verifyInstaller(data, signature, config.publicKeyPem)) {
        throw new Error('assinatura inválida')
      }
    } catch (err) {
      console.error('[update] instalador recusado:', err)
      await rm(event.downloadedFile, { force: true }).catch(() => {})
      return
    }

    readyVersion = event.version
    const verifiedBefore = readVerifiedVersion()
    saveVerifiedVersion(event.version)
    if (
      installOnStartup({
        version: event.version,
        verifiedBefore,
        msSinceStart: Date.now() - startedAt,
        inCall: isInCall()
      })
    ) {
      install()
      return
    }
    getWindow()?.webContents.send('update:ready', event.version)
  })

  // Chamada acabou: baixa o que ficou esperando.
  onCallStateChange((state) => {
    if (!state.inCall && pendingDownload) startDownload()
  })

  const check = (): void => {
    autoUpdater.checkForUpdates().catch((err) => console.error('[update] checagem falhou:', err))
  }
  check()
  setInterval(check, CHECK_INTERVAL_MS)
}
