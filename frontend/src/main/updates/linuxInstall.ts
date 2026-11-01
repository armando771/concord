// Instalação por usuário no Linux (sem FUSE, sem root) — regras puras.
//
//   <raiz>/versions/<versão>/   um .tar.gz assinado extraído por versão
//   <raiz>/current  -> versions/<versão>
//   <raiz>/previous -> versions/<anterior>
//
// Lançador, atalho e volta automática: build/linux/salinha-launcher.
// Download, verificação e troca: linuxUpdater.ts.
import { basename, dirname, isAbsolute, join, relative } from 'path'

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

/** Maior pacote aceito: o manifesto não é assinado e não pode encher o disco. */
export const MAX_PACKAGE_BYTES = 1024 ** 3

function isInside(path: string, dir: string): boolean {
  const rel = relative(dir, path)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Windows e AppImage montado ficam no electron-updater. Linux fora disso —
 * AppImage extraído (sem libfuse2) ou a instalação por usuário — usa o
 * updater próprio, que não depende de nada do sistema.
 *
 * APPIMAGE/APPDIR vazam para processos filhos (terminal aberto dentro de outro
 * AppImage): só conta como AppImage montado se o executável está dentro do
 * APPDIR, e a instalação por usuário (versions/) nunca conta. Senão o
 * electron-updater apagaria o AppImage de outro app ao instalar.
 */
export function updateBackendKind(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
  realExecPath: string
): UpdateBackendKind {
  if (platform !== 'linux') return 'electron-updater'
  if (managedRootOf(realExecPath)) return 'linux-managed'
  const mounted = !!env.APPIMAGE && !!env.APPDIR && isInside(realExecPath, env.APPDIR)
  return mounted ? 'electron-updater' : 'linux-managed'
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
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_PACKAGE_BYTES) return null
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

/**
 * Versões que o lançador desfez (não abriram): <raiz>/bad-versions, uma por
 * linha. Gravado por build/linux/salinha-launcher.
 */
export const BAD_VERSIONS_FILE = 'bad-versions'

export function parseBadVersions(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => VERSION_RE.test(l))
}

/**
 * Versão que voltou atrás não é oferecida de novo (senão a volta automática
 * reinstalaria a versão quebrada no próximo início). Só uma estritamente mais
 * nova que todas as ruins é oferecida — e aí a lista pode ser esquecida.
 */
export function badVersionCheck(bad: string[], latest: string): { skip: boolean; clear: boolean } {
  if (bad.includes(latest)) return { skip: true, clear: false }
  return { skip: false, clear: bad.length > 0 && bad.every((b) => compareVersions(latest, b) > 0) }
}

/**
 * O lançador abriu sem o sandbox do Chromium (SALINHA_SANDBOX_OFF=<motivo>):
 * o app mostra um aviso uma vez. null = nada a avisar.
 */
export function sandboxNoticeReason(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>
): string | null {
  return platform === 'linux' && env.SALINHA_SANDBOX_OFF ? env.SALINHA_SANDBOX_OFF : null
}
