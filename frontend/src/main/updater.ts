import { app, BrowserWindow, ipcMain, net } from 'electron'
import { autoUpdater, type UpdateDownloadedEvent } from 'electron-updater'
import { readFile, rm, writeFile } from 'fs/promises'
import { readFileSync } from 'fs'
import { basename, join } from 'path'
import { isInCall, markQuitting, onCallStateChange } from './background'
import {
  autoUpdateUnavailable,
  backgroundDownloadDelayMs,
  canDownloadUpdate,
  installOnStartup
} from './updatePolicy'
import { createUpdateCheckGate } from './updateCheck'
import { verifyInstaller } from './updateSignature'
import { clearCallResume, saveCallResume, takeCallResume } from './callResume'
import { validCallResume, type CallResume } from '../shared/callResume'

// Atualização automática servida pelo próprio servidor da Salinha
// (`<servidor>/updates/`). O instalador só é aceito com a assinatura Ed25519
// do dono (chave pública embutida no build).

// latest.yml tem poucas centenas de bytes: checar seguido não pesa. O caminho
// principal é o aviso do servidor (WS app:update → update:check-now); a
// checagem periódica é a rede de segurança.
const CHECK_INTERVAL_MS = 60_000

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
/** Versão nova encontrada (ainda baixando ou já pronta). */
let availableVersion: string | null = null
/** Versão baixada e com assinatura válida — pronta para instalar. */
let readyVersion: string | null = null
let downloading = false
/** Ficou esperando o fim da chamada para baixar em segundo plano. */
let pendingDownload = false
/** Download em segundo plano esperando o sorteio (backgroundDownloadDelayMs). */
let downloadTimer: ReturnType<typeof setTimeout> | null = null
/** A pessoa clicou em Atualizar: instala assim que terminar de baixar. */
let installRequested = false
let callSnapshot: CallResume | null = null
let installing = false

function install(onError: (message: string) => void): void {
  if (installing) return
  try {
    saveCallResume(callSnapshot)
  } catch (error) {
    console.error('[update] não foi possível salvar a chamada:', error)
    onError('Não foi possível salvar a chamada antes de atualizar. Tente novamente.')
    return
  }
  installing = true
  markQuitting()
  // silencioso e abre o app de novo ao terminar
  try {
    autoUpdater.quitAndInstall(true, true)
  } catch (error) {
    installing = false
    markQuitting(false)
    try {
      clearCallResume()
    } catch (cleanupError) {
      console.error('[update] erro ao limpar retomada:', cleanupError)
    }
    console.error('[update] instalação falhou:', error)
    onError('Não foi possível instalar a atualização.')
  }
}

async function fetchSignature(feedUrl: string, file: string): Promise<string> {
  const response = await net.fetch(new URL(`${encodeURIComponent(file)}.sig`, feedUrl).toString())
  if (!response.ok) throw new Error(`assinatura não encontrada (${response.status})`)
  return response.text()
}

/** Baixa a versão disponível. Em chamada, só se a pessoa pediu (force). */
function startDownload(force = false): void {
  if (downloading || readyVersion || !availableVersion) return
  if (!force && !canDownloadUpdate(isInCall())) {
    pendingDownload = true
    return
  }
  if (downloadTimer) {
    // Já esperando o sorteio: só o clique em Atualizar fura a fila.
    if (!force) return
    clearTimeout(downloadTimer)
    downloadTimer = null
  }
  const delay = backgroundDownloadDelayMs({
    force,
    msSinceStart: Date.now() - startedAt,
    random: Math.random()
  })
  if (delay > 0) {
    downloadTimer = setTimeout(() => {
      downloadTimer = null
      // Entrou em chamada durante a espera: fica para o fim dela.
      startDownloadNow(false)
    }, delay)
    return
  }
  startDownloadNow(force)
}

function startDownloadNow(force: boolean): void {
  if (downloading || readyVersion || !availableVersion) return
  if (!force && !canDownloadUpdate(isInCall())) {
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
  const send = (channel: string, value: unknown): void =>
    getWindow()?.webContents.send(channel, value)
  const installUpdate = (): void => install((message) => send('update:error', message))

  let pendingResume = takeCallResume()
  ipcMain.on('update:call-snapshot', (event, snapshot: unknown) => {
    if (event.sender !== getWindow()?.webContents) return
    callSnapshot = validCallResume(snapshot) ? snapshot : null
  })
  ipcMain.handle('update:take-call-resume', (event) => {
    if (event.sender !== getWindow()?.webContents) return null
    const pending = pendingResume
    pendingResume = null
    return pending
  })

  ipcMain.handle('update:status', () =>
    availableVersion
      ? { version: availableVersion, ready: readyVersion === availableVersion }
      : null
  )
  ipcMain.handle('update:unavailable', () =>
    autoUpdateUnavailable({
      platform: process.platform,
      isPackaged: app.isPackaged,
      appImage: process.env.APPIMAGE
    })
  )
  // Botão Atualizar: instala na hora se já baixou; senão baixa agora (mesmo
  // em chamada — a pessoa pediu) e instala quando terminar.
  ipcMain.on('update:install', () => {
    if (readyVersion) {
      installUpdate()
      return
    }
    installRequested = true
    startDownload(true)
  })

  // Sem endereço ou sem chave (build de desenvolvimento): não atualiza.
  if (!app.isPackaged || !config.feedUrl || !config.publicKeyPem) return

  autoUpdater.setFeedURL({ provider: 'generic', url: config.feedUrl })
  autoUpdater.autoDownload = false
  // A instalação passa pela verificação da assinatura — nunca automática.
  autoUpdater.autoInstallOnAppQuit = false

  // Aviso assim que existe versão nova (antes de baixar); versão mais nova
  // substitui a que já estava pronta.
  autoUpdater.on('update-available', (info: { version: string }) => {
    if (info.version !== availableVersion) {
      availableVersion = info.version
      readyVersion = null
    }
    send('update:available', info.version)
    startDownload(installRequested)
  })
  autoUpdater.on('download-progress', (progress: { percent: number }) => {
    send('update:progress', Math.round(progress.percent))
  })
  autoUpdater.on('error', (err) => {
    if (installing) markQuitting(false)
    installing = false
    try {
      clearCallResume()
    } catch (error) {
      console.error('[update] erro ao limpar retomada:', error)
    }
    downloading = false
    console.error('[update] erro:', err)
    if (installRequested) send('update:error', String(err))
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
      installRequested = false
      send('update:error', 'A atualização baixada não passou na verificação de segurança.')
      return
    }

    readyVersion = event.version
    const verifiedBefore = readVerifiedVersion()
    saveVerifiedVersion(event.version)
    const startup = installOnStartup({
      version: event.version,
      verifiedBefore,
      msSinceStart: Date.now() - startedAt,
      inCall: isInCall()
    })
    if (installRequested || startup) {
      installUpdate()
      return
    }
    send('update:ready', event.version)
  })

  // Chamada acabou: baixa o que ficou esperando.
  onCallStateChange((state) => {
    if (!state.inCall && pendingDownload) startDownload()
  })

  const gate = createUpdateCheckGate(() =>
    autoUpdater.checkForUpdates().catch((err) => console.error('[update] checagem falhou:', err))
  )
  // O renderer pede na hora: o servidor avisou de versão nova (WS app:update)
  // ou o WS reconectou (deploy reinicia o backend; o manifesto pode sair depois).
  ipcMain.on('update:check-now', (event) => {
    if (event.sender !== getWindow()?.webContents) return
    gate.request()
  })
  gate.run()
  setInterval(gate.run, CHECK_INTERVAL_MS)
}
