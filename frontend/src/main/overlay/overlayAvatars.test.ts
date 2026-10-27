import { describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import {
  AVATAR_MAX_BYTES,
  avatarFileName,
  createAvatarStore,
  fetchAvatarBytes,
  type AvatarStoreDeps,
  type FetchResponse
} from './overlayAvatars'

const URL_A = 'http://srv/api/profile-media/a_1'

function deps(over: Partial<AvatarStoreDeps> = {}): AvatarStoreDeps & { saved: string[] } {
  const saved: string[] = []
  return {
    dir: '/tmp/av',
    download: vi.fn(async () => new Uint8Array([1, 2, 3])),
    save: vi.fn(async (file: string) => {
      saved.push(file)
    }),
    exists: () => false,
    log: () => {},
    saved,
    ...over
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('avatarFileName', () => {
  it('nome estável e seguro a partir da URL', () => {
    expect(avatarFileName(URL_A)).toMatch(/^[0-9a-f]{40}$/)
    expect(avatarFileName(URL_A)).toBe(avatarFileName(URL_A))
    expect(avatarFileName(URL_A)).not.toBe(avatarFileName(URL_A + '/static'))
  })
})

describe('createAvatarStore', () => {
  it('baixa uma vez, avisa ao terminar e depois devolve o arquivo', async () => {
    const d = deps()
    const store = createAvatarStore(d)
    const changed = vi.fn()
    store.onChange(changed)
    expect(store.path(URL_A)).toBeUndefined()
    expect(store.path(URL_A)).toBeUndefined()
    await flush()
    const file = join('/tmp/av', avatarFileName(URL_A))
    expect(store.path(URL_A)).toBe(file)
    expect(d.download).toHaveBeenCalledTimes(1)
    expect(d.saved).toEqual([file])
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('arquivo de uma sessão anterior serve na hora', () => {
    const d = deps({ exists: () => true })
    const store = createAvatarStore(d)
    expect(store.path(URL_A)).toBe(join('/tmp/av', avatarFileName(URL_A)))
    expect(d.download).not.toHaveBeenCalled()
  })

  it('download que falha vira null (a inicial) e fica no log', async () => {
    const log = vi.fn()
    const store = createAvatarStore(
      deps({ log, download: async () => Promise.reject(new Error('HTTP 404')) })
    )
    store.path(URL_A)
    await flush()
    expect(store.path(URL_A)).toBeNull()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('HTTP 404'))
  })

  it('só http(s): o resto nem tenta', () => {
    const d = deps()
    const store = createAvatarStore(d)
    expect(store.path('blob:abc')).toBeNull()
    expect(store.path('file:///c:/x')).toBeNull()
    expect(d.download).not.toHaveBeenCalled()
  })

  it('sem ouvinte, terminar não quebra', async () => {
    const store = createAvatarStore(deps())
    store.onChange(vi.fn())
    store.onChange(null)
    store.path(URL_A)
    await flush()
    expect(store.path(URL_A)).toBeTruthy()
  })
})

describe('fetchAvatarBytes', () => {
  const response = (
    body: Uint8Array,
    init: { ok?: boolean; status?: number; length?: string } = {}
  ): FetchResponse => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: (name: string) => (name === 'content-length' ? (init.length ?? null) : null) },
    arrayBuffer: async () => body.buffer as ArrayBuffer
  })

  it('devolve os bytes', async () => {
    const bytes = await fetchAvatarBytes(async () => response(new Uint8Array([7, 8])), URL_A)
    expect([...bytes]).toEqual([7, 8])
  })

  it('erro HTTP e arquivo grande demais falham', async () => {
    await expect(fetchAvatarBytes(async () => response(new Uint8Array(), { ok: false, status: 404 }), URL_A)).rejects.toThrow('HTTP 404')
    const big = String(AVATAR_MAX_BYTES + 1)
    await expect(fetchAvatarBytes(async () => response(new Uint8Array(), { length: big }), URL_A)).rejects.toThrow('grande')
    await expect(
      fetchAvatarBytes(async () => response(new Uint8Array(AVATAR_MAX_BYTES + 1)), URL_A)
    ).rejects.toThrow('grande')
  })
})
