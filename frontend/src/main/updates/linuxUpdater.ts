// Atualização do Linux sem AppImage montado: AppImage extraído (sem libfuse2)
// ou a instalação por usuário (~/.local/share/salinha, ver linuxInstall.ts).
// Não depende de FUSE, root nem pacote do sistema: baixa o .tar.gz assinado,
// confere sha512 + tamanho (aqui) e a assinatura Ed25519 (updater.ts, igual ao
// Windows), extrai numa pasta nova e troca o link `current` de forma atômica.
//
// Fala a mesma "língua" do autoUpdater do electron-updater (eventos
// update-available / download-progress / update-downloaded / error e
// quitAndInstall) para o updater.ts tratar os dois do mesmo jeito.
import { spawnSync } from 'child_process'
import { createHash } from 'crypto'
import { EventEmitter } from 'events'
import {
  accessSync,
  constants,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import { readFile, rename, rm } from 'fs/promises'
import { basename, join } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import {
  BAD_VERSIONS_FILE,
  LINUX_EXECUTABLE,
  LINUX_LAUNCHER,
  LINUX_MANIFEST,
  LINUX_VERSION_FILE,
  STAGING_PREFIX,
  badVersionCheck,
  compareVersions,
  defaultInstallRoot,
  downloadsToPrune,
  managedRootOf,
  parseBadVersions,
  parseLinuxManifest,
  relaunchArgs,
  shouldOfferLinuxUpdate,
  versionsToPrune,
  type LinuxRelease
} from './linuxInstall'
import { extractTarGz } from '../app/tarGz'

export interface LinuxUpdaterOptions {
  /** ex.: http://abc.ply.gg:1234/updates/ */
  feedUrl: string
  currentVersion: string
  execPath: string
  home: string
  env: Record<string, string | undefined>
  /** argumentos da execução atual (sem o executável) */
  argv: string[]
  fetch: (url: string) => Promise<Response>
  relaunch: (options: { execPath: string; args: string[] }) => void
  quit: () => void
  /** roda `<launcher> --integrate` (padrão: spawnSync) */
  runIntegrate?: (launcher: string) => void
}

export interface LinuxDownloaded {
  version: string
  downloadedFile: string
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Troca o link de forma atômica (symlink novo + rename por cima). */
function replaceLink(target: string, link: string): void {
  const tmp = `${link}.new-${process.pid}`
  rmSync(tmp, { force: true })
  symlinkSync(target, tmp)
  renameSync(tmp, link)
}

function readLink(path: string): string | null {
  try {
    return readlinkSync(path)
  } catch {
    return null
  }
}

function defaultIntegrate(launcher: string): void {
  const result = spawnSync(launcher, ['--integrate'], { timeout: 15_000, stdio: 'ignore' })
  if (result.status !== 0) {
    throw new Error(`integração falhou (${result.error?.message ?? `código ${result.status}`})`)
  }
}

export class LinuxUpdater extends EventEmitter {
  /** raiz da instalação por usuário em que esta execução roda (ou null) */
  readonly managedRoot: string | null
  /** onde instalar: a raiz atual ou, migrando, a padrão */
  readonly root: string
  private latest: LinuxRelease | null = null
  private staged: string | null = null

  constructor(private readonly opts: LinuxUpdaterOptions) {
    super()
    let real = opts.execPath
    try {
      real = realpathSync(opts.execPath)
    } catch {
      // caminho que não existe (testes): usa como veio
    }
    this.managedRoot = managedRootOf(real)
    this.root = this.managedRoot ?? defaultInstallRoot(opts.env, opts.home)
  }

  private url(file: string): string {
    return new URL(encodeURIComponent(file), this.opts.feedUrl).toString()
  }

  async checkForUpdates(): Promise<LinuxRelease | null> {
    // Query muda a cada vez: nenhum cache no caminho devolve manifesto velho.
    const response = await this.opts.fetch(`${this.url(LINUX_MANIFEST)}?t=${Date.now()}`)
    if (!response.ok) throw new Error(`${LINUX_MANIFEST}: HTTP ${response.status}`)
    const release = parseLinuxManifest(await response.text())
    if (!release) throw new Error(`${LINUX_MANIFEST}: manifesto inválido`)
    // Versão que o lançador desfez (não abriu): só uma estritamente mais nova.
    const bad = this.badVersions()
    const { skip, clear } = badVersionCheck(bad, release.version)
    if (skip) return null
    const offer = shouldOfferLinuxUpdate({
      current: this.opts.currentVersion,
      latest: release.version,
      managed: this.managedRoot !== null
    })
    if (!offer) return null
    if (clear) rmSync(join(this.root, BAD_VERSIONS_FILE), { force: true })
    if (this.latest?.version !== release.version || this.latest.sha512 !== release.sha512) {
      this.staged = null
    }
    this.latest = release
    this.emit('update-available', {
      version: release.version,
      path: release.path,
      sha512: release.sha512
    })
    return release
  }

  private badVersions(): string[] {
    try {
      return parseBadVersions(readFileSync(join(this.root, BAD_VERSIONS_FILE), 'utf8'))
    } catch {
      return []
    }
  }

  /**
   * Instalar sozinho ao abrir: nunca a mesma versão (migração do AppImage
   * extraído é só com clique) nem uma que já voltou atrás.
   */
  canAutoInstall(version: string): boolean {
    return (
      compareVersions(version, this.opts.currentVersion) > 0 &&
      !this.badVersions().includes(version)
    )
  }

  async downloadUpdate(): Promise<string> {
    try {
      return await this.download()
    } catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  private async download(): Promise<string> {
    const release = this.latest
    if (!release) throw new Error('nenhuma atualização para baixar')
    const dir = join(this.root, 'downloads')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, release.path)

    // Já baixado numa sessão anterior (instalação ao abrir): só confere.
    if (existsSync(file) && (await this.matches(file, release))) {
      this.emit('download-progress', { percent: 100 })
      this.emit('update-downloaded', { version: release.version, downloadedFile: file })
      return file
    }

    const part = `${file}.part`
    try {
      const response = await this.opts.fetch(this.url(release.path))
      if (!response.ok || !response.body) throw new Error(`download: HTTP ${response.status}`)
      const hash = createHash('sha512')
      let received = 0
      let lastPercent = -1
      const progress = new Transform({
        transform: (chunk: Buffer, _enc, done) => {
          hash.update(chunk)
          received += chunk.length
          if (received > release.size) {
            done(new Error('tamanho maior que o do manifesto'))
            return
          }
          const percent = Math.floor((received / release.size) * 100)
          if (percent !== lastPercent) {
            lastPercent = percent
            this.emit('download-progress', { percent })
          }
          done(null, chunk)
        }
      })
      await pipeline(
        Readable.fromWeb(response.body as import('stream/web').ReadableStream),
        progress,
        createWriteStream(part)
      )
      if (received !== release.size) throw new Error('tamanho diferente do manifesto')
      if (hash.digest('hex') !== release.sha512) throw new Error('sha512 não confere')
      await rename(part, file)
    } catch (error) {
      await rm(part, { force: true }).catch(() => {})
      throw error
    }
    this.emit('update-downloaded', { version: release.version, downloadedFile: file })
    return file
  }

  private async matches(file: string, release: LinuxRelease): Promise<boolean> {
    const data = await readFile(file)
    return (
      data.length === release.size &&
      createHash('sha512').update(data).digest('hex') === release.sha512
    )
  }

  /**
   * Depois da assinatura conferida (updater.ts): extrai numa pasta nova de
   * versions/ e confere a versão gravada dentro do pacote — o manifesto não é
   * assinado, então é ela que impede servir um pacote antigo como "novo".
   * Uma pasta versions/<v> que já existe e passa em valid() é reaproveitada sem
   * reverificar: só o próprio usuário escreve ali.
   */
  async stage(event: LinuxDownloaded, data?: Buffer): Promise<void> {
    const { version, downloadedFile } = event
    if (!this.latest || this.latest.version !== version) {
      throw new Error(`versão ${version} não foi a anunciada`)
    }
    const versions = join(this.root, 'versions')
    const final = join(versions, version)
    mkdirSync(versions, { recursive: true })
    if (this.valid(final, version)) {
      this.staged = version
      return
    }
    const tmp = join(versions, `${STAGING_PREFIX}${version}-${process.pid}`)
    rmSync(tmp, { recursive: true, force: true })
    mkdirSync(tmp)
    try {
      // Dos bytes que passaram na assinatura (data), não do arquivo relido.
      await extractTarGz(data ? Readable.from([data]) : createReadStream(downloadedFile), tmp)
      if (!this.valid(tmp, version)) {
        throw new Error(`pacote não é a versão ${version} completa`)
      }
      // Pasta incompleta de uma tentativa anterior (nunca a que está em uso:
      // essa passaria no valid acima).
      rmSync(final, { recursive: true, force: true })
      renameSync(tmp, final)
    } catch (error) {
      rmSync(tmp, { recursive: true, force: true })
      throw error
    }
    this.staged = version
  }

  private valid(dir: string, version: string): boolean {
    try {
      return (
        readFileSync(join(dir, LINUX_VERSION_FILE), 'utf8').trim() === version &&
        isExecutable(join(dir, LINUX_EXECUTABLE)) &&
        isExecutable(join(dir, LINUX_LAUNCHER))
      )
    } catch {
      return false
    }
  }

  /** Troca para a versão preparada e reabre pelo lançador. Síncrono. */
  quitAndInstall(): void {
    const version = this.staged
    if (!version || !this.valid(join(this.root, 'versions', version), version)) {
      throw new Error('nenhuma versão preparada para instalar')
    }
    const current = join(this.root, 'current')
    const target = `versions/${version}`
    const before = readLink(current)
    // Primeiro o aviso para o lançador: se a nova não abrir, ele volta.
    if (before && before !== target) {
      replaceLink(before, join(this.root, 'previous'))
      writeFileSync(join(this.root, 'boot-pending'), `${version}\n`)
    }
    replaceLink(target, current)

    const launcher = join(current, LINUX_LAUNCHER)
    try {
      ;(this.opts.runIntegrate ?? defaultIntegrate)(launcher)
    } catch (error) {
      // O app já está no lugar; só o atalho/menu ficou para a próxima.
      console.error('[update] atalho do Linux:', error)
    }
    this.opts.relaunch({ execPath: launcher, args: relaunchArgs(this.opts.argv) })
    this.opts.quit()
  }

  /**
   * Ao abrir na instalação por usuário: confirma para o lançador que esta
   * versão abriu (não volta mais) e limpa versões velhas e downloads.
   */
  confirmStartup(): void {
    const root = this.managedRoot
    if (!root) return
    const pending = join(root, 'boot-pending')
    try {
      if (readFileSync(pending, 'utf8').split('\n')[0] === this.opts.currentVersion) {
        rmSync(pending, { force: true })
      }
    } catch {
      // sem boot-pending: nada a confirmar
    }
    const previous = readLink(join(root, 'previous'))
    try {
      const versions = join(root, 'versions')
      const prune = versionsToPrune(readdirSync(versions), {
        current: this.opts.currentVersion,
        previous: previous ? basename(previous) : null,
        pid: process.pid
      })
      for (const name of prune) rmSync(join(versions, name), { recursive: true, force: true })
      const downloads = join(root, 'downloads')
      if (existsSync(downloads)) {
        for (const name of downloadsToPrune(readdirSync(downloads), this.opts.currentVersion)) {
          rmSync(join(downloads, name), { force: true })
        }
      }
    } catch (error) {
      console.error('[update] limpeza das versões antigas:', error)
    }
  }
}
