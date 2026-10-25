// Instalação por usuário no Linux (sem FUSE, sem root) — regras puras.
//
//   <raiz>/versions/<versão>/   um .tar.gz assinado extraído por versão
//   <raiz>/current  -> versions/<versão>
//   <raiz>/previous -> versions/<anterior>
//
// Lançador, atalho e volta automática: build/linux/salinha-launcher.
// Download, verificação e troca: linuxUpdater.ts.
import { basename, dirname, isAbsolute, join } from 'path'

export type UpdateBackendKind = 'electron-updater' | 'linux-managed'

/** Manifesto do .tar.gz (latest-linux-tar.yml, gerado pelo release-linux.sh). */
export const LINUX_MANIFEST = 'latest-linux-tar.yml'
/** Executável do app dentro de cada versão. */
export const LINUX_EXECUTABLE = 'salinha'
export const LINUX_LAUNCHER = 'salinha-launcher'
/** Versão gravada pelo build dentro do .tar.gz (coberta pela assinatura). */
export const LINUX_VERSION_FILE = 'salinha-version'
export const STAGING_PREFIX = '.staging-'

const VERSION_RE = /^\d+\.\d+\.\d+$/

/**
 * Windows e AppImage montado (APPIMAGE definido) ficam no electron-updater.
 * Linux sem AppImage — AppImage extraído (sem libfuse2) ou a instalação por
 * usuário — usa o updater próprio, que não depende de nada do sistema.
 */
export function updateBackendKind(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>
): UpdateBackendKind {
  return platform === 'linux' && !env.APPIMAGE ? 'linux-managed' : 'electron-updater'
}

export function defaultInstallRoot(env: Record<string, string | undefined>, home: string): string {
  const data = env.XDG_DATA_HOME
  return join(data && isAbsolute(data) ? data : join(home, '.local', 'share'), 'salinha')
}

/**
 * Raiz da instalação por usuário a que o executável (caminho real) pertence:
 * `<raiz>/versions/<x.y.z>/salinha`. null = outro lugar (AppImage extraído…).
 */
export function managedRootOf(realExecPath: string): string | null {
  if (basename(realExecPath) !== LINUX_EXECUTABLE) return null
  const versionDir = dirname(realExecPath)
  const versions = dirname(versionDir)
  if (!VERSION_RE.test(basename(versionDir)) || basename(versions) !== 'versions') return null
  return dirname(versions)
}

function parseVersion(v: string): number[] | null {
  return VERSION_RE.test(v) ? v.split('.').map(Number) : null
}

/** >0 se a é mais nova que b. Versão inválida conta como a mais velha. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa) return pb ? -1 : 0
  if (!pb) return 1
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2]
}

/**
 * Versão mais nova sempre. A mesma versão só para quem roda fora da instalação
 * por usuário (AppImage extraído): "atualizar" para ela é migrar para o
 * layout que se atualiza sozinho.
 */
export function shouldOfferLinuxUpdate(state: {
  current: string
  latest: string
  managed: boolean
}): boolean {
  const cmp = compareVersions(state.latest, state.current)
  return cmp > 0 || (cmp === 0 && !state.managed)
}

export interface LinuxRelease {
  version: string
  /** nome do arquivo, relativo ao endereço das atualizações */
  path: string
  /** sha512 em hex minúsculo */
  sha512: string
  size: number
}

/** Lê o manifesto (formato fixo `chave: valor`). null se algo não bate. */
export function parseLinuxManifest(text: string): LinuxRelease | null {
  const fields: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^([a-zA-Z0-9]+):\s*(.*)$/.exec(line)
    if (m) fields[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  const { version, path } = fields
  const sha512 = fields.sha512?.toLowerCase()
  const size = Number(fields.size)
  if (!version || !VERSION_RE.test(version)) return null
  // O nome amarra o arquivo à versão; nada de caminho nem URL.
  if (path !== `Salinha-${version}-x64.tar.gz`) return null
  if (!sha512 || !/^[0-9a-f]{128}$/.test(sha512)) return null
  if (!Number.isSafeInteger(size) || size <= 0) return null
  return { version, path, sha512, size }
}

/** Flags que o lançador acrescenta sozinho: ele decide de novo ao reabrir. */
export function relaunchArgs(argv: string[]): string[] {
  return argv.filter((a) => a !== '--no-sandbox' && !a.startsWith('--ozone-platform-hint='))
}

/**
 * Pastas de versions/ que podem ser apagadas: versões mais velhas que a atual
 * (menos a anterior, para a volta automática) e extrações abandonadas. Versão
 * mais nova fica: pode estar preparada esperando a instalação.
 */
export function versionsToPrune(
  entries: string[],
  keep: { current: string; previous: string | null; pid: number }
): string[] {
  return entries.filter((e) =>
    e.startsWith(STAGING_PREFIX)
      ? !e.endsWith(`-${keep.pid}`)
      : VERSION_RE.test(e) && e !== keep.previous && compareVersions(e, keep.current) < 0
  )
}

/** Pacotes baixados que já não servem (até a versão atual). */
export function downloadsToPrune(entries: string[], current: string): string[] {
  return entries.filter((e) => {
    const m = /^Salinha-(\d+\.\d+\.\d+)-x64\.tar\.gz(\.part)?$/.exec(e)
    return m !== null && compareVersions(m[1], current) <= 0
  })
}
