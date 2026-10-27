import { createHash } from 'crypto'
import { join } from 'path'

// Avatares do overlay nativo: o main baixa (com a sessão do Electron) e grava
// num arquivo; o helper só abre o arquivo pelo WIC. Assim o Rust não precisa de
// HTTP. O nome do arquivo vem da URL (as do profile-media não mudam de
// conteúdo), então um arquivo de uma sessão anterior serve direto.

/** Avatar maior que isso nem é baixado (o app limita bem abaixo). */
export const AVATAR_MAX_BYTES = 8 * 1024 * 1024

export interface AvatarStoreDeps {
  dir: string
  download: (url: string) => Promise<Uint8Array>
  save: (file: string, bytes: Uint8Array) => Promise<void>
  exists: (file: string) => boolean
  log: (message: string) => void
}

export interface AvatarStore {
  /** Caminho do arquivo; null = sem avatar (falhou); undefined = baixando. */
  path: (url: string) => string | null | undefined
  /** Chamado quando um download termina (null para de avisar). */
  onChange: (listener: (() => void) | null) => void
}

export function avatarFileName(url: string): string {
  return createHash('sha1').update(url).digest('hex')
}

export function createAvatarStore(deps: AvatarStoreDeps): AvatarStore {
  const known = new Map<string, string | null | undefined>()
  let listener: (() => void) | null = null

  const start = (url: string, file: string): void => {
    known.set(url, undefined)
    deps
      .download(url)
      .then((bytes) => deps.save(file, bytes))
      .then(() => known.set(url, file))
      .catch((err: unknown) => {
        known.set(url, null)
        deps.log(`overlay: avatar não baixou (${url}): ${err instanceof Error ? err.message : String(err)}`)
      })
      .finally(() => listener?.())
  }

  return {
    path: (url) => {
      if (known.has(url)) return known.get(url)
      if (!/^https?:\/\//.test(url)) return null
      const file = join(deps.dir, avatarFileName(url))
      if (deps.exists(file)) {
        known.set(url, file)
        return file
      }
      start(url, file)
      return undefined
    },
    onChange: (next) => {
      listener = next
    }
  }
}

export interface FetchResponse {
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  arrayBuffer: () => Promise<ArrayBuffer>
}

/** Baixa os bytes (net.fetch do Electron), recusando erro HTTP e arquivo grande. */
export async function fetchAvatarBytes(
  fetchFn: (url: string) => Promise<FetchResponse>,
  url: string
): Promise<Uint8Array> {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const tooBig = (size: number): boolean => size > AVATAR_MAX_BYTES
  if (tooBig(Number(res.headers.get('content-length') ?? 0))) throw new Error('arquivo grande demais')
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (tooBig(bytes.length)) throw new Error('arquivo grande demais')
  return bytes
}
