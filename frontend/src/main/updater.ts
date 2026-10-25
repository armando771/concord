import { app, BrowserWindow, ipcMain, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import { homedir } from 'os'
import { readFile, rm, writeFile } from 'fs/promises'
import { readFileSync } from 'fs'
import { basename, join } from 'path'
import { isInCall, markQuitting, onCallStateChange } from './background'
import { backgroundDownloadDelayMs, canDownloadUpdate, installOnStartup } from './updatePolicy'
import { createUpdateCheckGate } from './updateCheck'
import { verifyInstaller } from './updateSignature'
import { clearCallResume, saveCallResume, takeCallResume } from './callResume'
import { validCallResume, type CallResume } from '../shared/callResume'
import { appendLog } from './appLog'
import { updateBackendKind } from './linuxInstall'
import { LinuxUpdater } from './linuxUpdater'

// Atualização automática servida pelo próprio servidor da Salinha
// (`<servidor>/updates/`). O instalador só é aceito com a assinatura Ed25519
// do dono (chave pública embutida no build).
//
// Windows e AppImage montado: electron-updater. Linux sem AppImage (AppImage
// extraído, sem libfuse2, ou a instalação por usuário em ~/.local/share/salinha):
// linuxUpdater.ts, que baixa o .tar.gz assinado e não depende de nada do
// sistema. Os dois passam pelas mesmas regras (chamada, Atualizar, assinatura).

// latest.yml tem poucas centenas de bytes: checar seguido não pesa. O caminho
// principal é o aviso do servidor (WS app:update → update:check-now); a
// checagem periódica é a rede de segurança.
const CHECK_INTERVAL_MS = 60_000
/** Linux: depois disso aberto, a versão nova "pegou" e o lançador não volta. */
const BOOT_CONFIRM_MS = 10_000

interface DownloadedUpdate {
  version: string
  downloadedFile: string
}

/** O que o updater usa do autoUpdater (e o LinuxUpdater também oferece). */
interface UpdateBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void
  /** Linux: extrai e confere o pacote (já com a assinatura válida). */
  stage?(event: DownloadedUpdate): Promise<void>
}

let backend: UpdateBackend = autoUpdater

interface UpdaterConfig {
  /** ex.: http://abc.ply.gg:1234/updates/ */
  feedUrl: string
  publicKeyPem: string
}

const startedAt = Date.now()

/** Console e, no Linux, ~/.config/Concord/logs/update.log (o app abre sem terminal). */
function logUpdate(message: string, error: unknown): void {
  console.error(`[update] ${message}:`, error)
  if (process.platform === 'linux') appendLog('update.log', `${message}: ${String(error)}`)
}

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
    logUpdate('não foi possível salvar a chamada', error)
    onError('Não foi possível salvar a chamada antes de atualizar. Tente novamente.')
    return
  }
  installing = true
  markQuitting()
  // silencioso e abre o app de novo ao terminar
  try {
    backend.quitAndInstall(true, true)
  } catch (error) {
    installing = false
    markQuitting(false)
    try {
      clearCallResume()
    } catch (cleanupError) {
      logUpdate('erro ao limpar retomada', cleanupError)
    }
    logUpdate('instalação falhou', error)
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
  backend.downloadUpdate().catch((err) => {
    downloading = false
    logUpdate('download falhou', err)
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

  if (updateBackendKind(process.platform, process.env) === 'linux-managed') {
    const linux = new LinuxUpdater({
      feedUrl: config.feedUrl,
      currentVersion: app.getVersion(),
      execPath: process.execPath,
      home: homedir(),
      env: process.env,
      argv: process.argv.slice(1),
      fetch: (url) => net.fetch(url),
      relaunch: (options) => app.relaunch(options),
      quit: () => app.quit()
    })
    setTimeout(() => linux.confirmStartup(), BOOT_CONFIRM_MS)
    backend = linux
  } else {
    autoUpdater.setFeedURL({ provider: 'generic', url: config.feedUrl })
    autoUpdater.autoDownload = false
    // A instalação passa pela verificação da assinatura — nunca automática.
    autoUpdater.autoInstallOnAppQuit = false
    backend = autoUpdater
  }

  // Aviso assim que existe versão nova (antes de baixar); versão mais nova
  // substitui a que já estava pronta.
  backend.on('update-available', (info: { version: string }) => {
    if (info.version !== availableVersion) {
      availableVersion = info.version
      readyVersion = null
    }
    send('update:available', info.version)
    startDownload(installRequested)
  })
  backend.on('download-progress', (progress: { percent: number }) => {
    send('update:progress', Math.round(progress.percent))
  })
  backend.on('error', (err: unknown) => {
    if (installing) markQuitting(false)
    installing = false
    try {
      clearCallResume()
    } catch (error) {
      logUpdate('erro ao limpar retomada', error)
    }
    downloading = false
    logUpdate('erro', err)
    if (installRequested) send('update:error', String(err))
  })
  backend.on('update-downloaded', async (event: DownloadedUpdate) => {
    downloading = false
    try {
      const [data, signature] = await Promise.all([
        readFile(event.downloadedFile),
        fetchSignature(config.feedUrl, basename(event.downloadedFile))
      ])
      if (!verifyInstaller(data, signature, config.publicKeyPem)) {
        throw new Error('assinatura inválida')
      }
      // Só depois da assinatura: extrai e confere a versão dentro do pacote.
      if (backend.stage) await backend.stage(event)
    } catch (err) {
      logUpdate('instalador recusado', err)
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
    backend.checkForUpdates().catch((err) => logUpdate('checagem falhou', err))
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
