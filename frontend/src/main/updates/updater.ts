import { app, BrowserWindow, ipcMain, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import { homedir } from 'os'
import { readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { readFileSync, realpathSync } from 'fs'
import { basename, join } from 'path'
import { isInCall, markQuitting, onCallStateChange } from '../window/background'
import {
  autoUpdateUnavailable,
  backgroundDownloadDelayMs,
  canDownloadUpdate,
  installOnStartup,
  isRefusedRelease,
  retryDelayMs,
  type ReleaseId
} from './updatePolicy'
import { createUpdateCheckGate } from './updateCheck'
import { verifyInstaller } from './updateSignature'
import { clearCallResume, saveCallResume, takeCallResume } from './callResume'
import { validCallResume, type CallResume } from '../../shared/callResume'
import { appendLog, logPath } from '../app/appLog'
import { sandboxNoticeReason, updateBackendKind } from './linuxInstall'
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

/** O que o electron-updater (UpdateInfo) e o LinuxUpdater mandam em update-available. */
interface AvailableUpdate {
  version: string
  /** arquivo, relativo ao endereço das atualizações */
  path?: string
  sha512?: string
  files?: Array<{ url?: string; sha512?: string }>
}

/** O que o updater usa do autoUpdater (e o LinuxUpdater também oferece). */
interface UpdateBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void
  /** Linux: extrai e confere o pacote (os bytes já com a assinatura válida). */
  stage?(event: DownloadedUpdate, data: Buffer): Promise<void>
  /** Linux: false = só com clique (migração, versão que já voltou atrás). */
  canAutoInstall?(version: string): boolean
}

let backend: UpdateBackend = autoUpdater

interface UpdaterConfig {
  /** ex.: http://abc.ply.gg:1234/updates/ */
  feedUrl: string
  publicKeyPem: string
}

const startedAt = Date.now()

const LOG_MAX_BYTES = 512 * 1024

/** Console e, no Linux, ~/.config/Concord/logs/update.log (o app abre sem terminal). */
function logUpdate(message: string, error: unknown): void {
  console.error(`[update] ${message}:`, error)
  if (process.platform !== 'linux') return
  appendLog('update.log', `${message}: ${String(error)}`)
  // Um arquivo antigo só (update.log.1): não cresce para sempre.
  const path = logPath('update.log')
  void stat(path)
    .then((info) => (info.size > LOG_MAX_BYTES ? rename(path, `${path}.1`) : undefined))
    .catch(() => {})
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

const sandboxNoticePath = (): string => join(app.getPath('userData'), 'sandbox-notice.json')

function readSandboxNoticeShown(): boolean {
  try {
    readFileSync(sandboxNoticePath())
    return true
  } catch {
    return false
  }
}

function saveSandboxNoticeShown(): void {
  void writeFile(sandboxNoticePath(), JSON.stringify({ shown: true })).catch(() => {})
}

// Atualização recusada (assinatura ou pacote inválido): o mesmo par versão +
// sha512 nunca é baixado de novo, nem depois de reiniciar.
const refusedPath = (): string => join(app.getPath('userData'), 'update-refused.json')

function readRefused(): ReleaseId | null {
  try {
    const value = JSON.parse(readFileSync(refusedPath(), 'utf8')) as Partial<ReleaseId>
    return typeof value.version === 'string'
      ? { version: value.version, sha512: typeof value.sha512 === 'string' ? value.sha512 : '' }
      : null
  } catch {
    return null
  }
}

function saveRefused(release: ReleaseId | null): void {
  refused = release
  const write = release
    ? writeFile(refusedPath(), JSON.stringify(release))
    : rm(refusedPath(), { force: true })
  void write.catch(() => {})
}

function releaseId(info: AvailableUpdate): ReleaseId {
  return { version: info.version, sha512: info.sha512 ?? info.files?.[0]?.sha512 ?? '' }
}

function releaseFile(info: AvailableUpdate): string | null {
  const file = info.path ?? info.files?.[0]?.url
  return file && !file.includes('/') ? file : null
}
/** Versão nova encontrada (ainda baixando ou já pronta). */
let availableVersion: string | null = null
/** O que o manifesto oferece agora (versão + sha512) e o arquivo dele. */
let availableRelease: ReleaseId | null = null
let availableFile: string | null = null
let refused: ReleaseId | null = null
/** Falhas seguidas de download/verificação desta oferta, e quando tentar de novo. */
let failures = 0
let retryAt = 0
/** .sig já baixado (antes do pacote) para o arquivo oferecido. */
let signatureCache: { file: string; signature: string } | null = null
let feedUrl = ''
/** Linux fora do AppImage montado: o updater próprio está ativo. */
let linuxSelfUpdating = false
let sendToWindow: (channel: string, value: unknown) => void = () => {}
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

/** Falhou (rede, assinatura indisponível): espera cada vez mais antes de tentar. */
function noteFailure(message: string, error: unknown): void {
  failures += 1
  retryAt = Date.now() + retryDelayMs(failures)
  logUpdate(
    `${message} (nova tentativa em ${Math.round(retryDelayMs(failures) / 60_000)} min)`,
    error
  )
}

const REFUSED_MESSAGE = 'A atualização baixada não passou na verificação de segurança.'

/** Baixa a versão disponível. Em chamada, só se a pessoa pediu (force). */
function startDownload(force = false): void {
  if (downloading || readyVersion || !availableVersion) return
  if (availableRelease && isRefusedRelease(refused, availableRelease)) {
    if (force) {
      installRequested = false
      sendToWindow('update:error', REFUSED_MESSAGE)
    }
    return
  }
  // Depois de falhas, só o clique em Atualizar fura a espera.
  if (!force && Date.now() < retryAt) return
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
  void downloadWithSignature()
}

/**
 * Primeiro o .sig (poucos bytes): sem ele publicado não adianta baixar o
 * pacote (~140 MB). Depois o pacote.
 */
async function downloadWithSignature(): Promise<void> {
  const file = availableFile
  if (file && signatureCache?.file !== file) {
    try {
      signatureCache = { file, signature: await fetchSignature(feedUrl, file) }
    } catch (err) {
      downloading = false
      noteFailure('assinatura indisponível', err)
      if (installRequested) {
        installRequested = false
        sendToWindow(
          'update:error',
          'Não foi possível conferir a atualização agora. Tente mais tarde.'
        )
      }
      return
    }
  }
  try {
    await backend.downloadUpdate()
  } catch (err) {
    downloading = false
    noteFailure('download falhou', err)
  }
}

export function setupUpdater(getWindow: () => BrowserWindow | null, config: UpdaterConfig): void {
  const send = (channel: string, value: unknown): void =>
    getWindow()?.webContents.send(channel, value)
  sendToWindow = send
  feedUrl = config.feedUrl
  refused = readRefused()
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

  ipcMain.handle('update:current-version', () => app.getVersion())
  ipcMain.handle('update:status', () =>
    availableVersion
      ? { version: availableVersion, ready: readyVersion === availableVersion }
      : null
  )
  ipcMain.handle('update:unavailable', () =>
    autoUpdateUnavailable({
      platform: process.platform,
      isPackaged: app.isPackaged,
      appImage: process.env.APPIMAGE,
      selfUpdating: linuxSelfUpdating
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

  // Linux: o lançador abriu sem o sandbox do Chromium — avisa uma vez.
  let sandboxNotice = sandboxNoticeReason(process.platform, process.env)
  ipcMain.handle('update:sandbox-notice', (event) => {
    if (event.sender !== getWindow()?.webContents || !sandboxNotice) return null
    const reason = sandboxNotice
    sandboxNotice = null
    if (readSandboxNoticeShown()) return null
    saveSandboxNoticeShown()
    return reason
  })

  // Sem endereço ou sem chave (build de desenvolvimento): não atualiza.
  if (!app.isPackaged || !config.feedUrl || !config.publicKeyPem) return

  let realExecPath = process.execPath
  try {
    realExecPath = realpathSync(process.execPath)
  } catch {
    // fica o caminho como veio
  }
  if (updateBackendKind(process.platform, process.env, realExecPath) === 'linux-managed') {
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
    linuxSelfUpdating = true
  } else {
    autoUpdater.setFeedURL({ provider: 'generic', url: config.feedUrl })
    autoUpdater.autoDownload = false
    // A instalação passa pela verificação da assinatura — nunca automática.
    autoUpdater.autoInstallOnAppQuit = false
    backend = autoUpdater
  }

  // Aviso assim que existe versão nova (antes de baixar); versão mais nova
  // substitui a que já estava pronta.
  backend.on('update-available', (info: AvailableUpdate) => {
    const offer = releaseId(info)
    if (offer.version !== availableRelease?.version || offer.sha512 !== availableRelease?.sha512) {
      // Manifesto novo: zera a espera entre tentativas.
      availableRelease = offer
      availableFile = releaseFile(info)
      failures = 0
      retryAt = 0
      signatureCache = null
    }
    if (isRefusedRelease(refused, offer)) return
    if (refused) saveRefused(null)
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
    const file = basename(event.downloadedFile)
    let signature: string
    try {
      signature =
        signatureCache?.file === file
          ? signatureCache.signature
          : await fetchSignature(config.feedUrl, file)
    } catch (err) {
      // Falha passageira (rede, .sig no meio do deploy): o download fica.
      noteFailure('assinatura indisponível', err)
      installRequested = false
      send('update:error', 'Não foi possível conferir a atualização agora. Tente mais tarde.')
      return
    }
    try {
      const data = await readFile(event.downloadedFile)
      if (!verifyInstaller(data, signature, config.publicKeyPem)) {
        throw new Error('assinatura inválida')
      }
      // Só depois da assinatura: extrai (dos mesmos bytes conferidos) e
      // confere a versão dentro do pacote.
      if (backend.stage) await backend.stage(event, data)
    } catch (err) {
      logUpdate('instalador recusado', err)
      await rm(event.downloadedFile, { force: true }).catch(() => {})
      signatureCache = null
      saveRefused(
        availableRelease?.version === event.version
          ? availableRelease
          : { version: event.version, sha512: '' }
      )
      installRequested = false
      send('update:error', REFUSED_MESSAGE)
      return
    }
    failures = 0
    retryAt = 0

    readyVersion = event.version
    const verifiedBefore = readVerifiedVersion()
    saveVerifiedVersion(event.version)
    const startup =
      installOnStartup({
        version: event.version,
        verifiedBefore,
        msSinceStart: Date.now() - startedAt,
        inCall: isInCall()
      }) && backend.canAutoInstall?.(event.version) !== false
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
