import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPreviewSender, waitUntil } from './screenPreviewFlow'
import { PREVIEW_CAPTURE_EVERY_MS } from './screenPreview'

describe('createPreviewSender', () => {
  it('tira e manda a foto da chamada certa', async () => {
    const upload = vi.fn(async () => {})
    const send = createPreviewSender({ capture: async (s: string) => `foto-${s}`, upload })
    expect(await send('c1', 'tela')).toBe(true)
    expect(upload).toHaveBeenCalledWith('c1', 'foto-tela')
  })

  it('pedidos seguidos viram uma foto só', async () => {
    let t = 0
    const capture = vi.fn(async () => 'x')
    const send = createPreviewSender({ capture, upload: async () => {}, now: () => t })
    expect(await send('c1', 's')).toBe(true)
    t = PREVIEW_CAPTURE_EVERY_MS - 1
    expect(await send('c1', 's')).toBe(false)
    t = PREVIEW_CAPTURE_EVERY_MS
    expect(await send('c1', 's')).toBe(true)
    expect(capture).toHaveBeenCalledTimes(2)
  })

  it('uma de cada vez, mesmo com o relógio liberando', async () => {
    let t = 0
    let release: (v: string) => void = () => {}
    const capture = vi.fn(() => new Promise<string>((r) => (release = r)))
    const send = createPreviewSender({ capture, upload: async () => {}, now: () => t })
    const first = send('c1', 's')
    t = 10 * PREVIEW_CAPTURE_EVERY_MS
    expect(await send('c1', 's')).toBe(false)
    release('x')
    expect(await first).toBe(true)
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it('sem frame ou com erro no envio não quebra', async () => {
    let t = 0
    const now = (): number => (t += PREVIEW_CAPTURE_EVERY_MS)
    const noFrame = createPreviewSender({ capture: async () => null, upload: vi.fn(), now })
    expect(await noFrame('c1', 's')).toBe(false)
    const failing = createPreviewSender({
      capture: async () => 'x',
      upload: async () => {
        throw new Error('429')
      },
      now
    })
    expect(await failing('c1', 's')).toBe(false)
  })
})

function fakeStore<T>(initial: T): {
  getState: () => T
  subscribe: (fn: (s: T) => void) => () => void
  set: (s: T) => void
  listeners: () => number
} {
  let state = initial
  const subs = new Set<(s: T) => void>()
  return {
    getState: () => state,
    subscribe: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    set: (s) => {
      state = s
      subs.forEach((fn) => fn(s))
    },
    listeners: () => subs.size
  }
}

describe('waitUntil', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('já pronto resolve na hora', async () => {
    expect(await waitUntil(fakeStore(1), (n) => n === 1, 1000)).toBe(true)
  })

  it('espera o estado ficar pronto e para de ouvir', async () => {
    const store = fakeStore<string[]>([])
    const p = waitUntil(store, (s) => s.includes('ana'), 1000)
    store.set(['bia'])
    store.set(['bia', 'ana'])
    expect(await p).toBe(true)
    expect(store.listeners()).toBe(0)
  })

  it('desiste quando ready devolve null', async () => {
    const store = fakeStore('conectando')
    const p = waitUntil(store, (s) => (s === 'saiu' ? null : s === 'pronto'), 1000)
    store.set('saiu')
    expect(await p).toBe(false)
    expect(store.listeners()).toBe(0)
  })

  it('passa do prazo: false', async () => {
    vi.useFakeTimers()
    const store = fakeStore(0)
    const p = waitUntil(store, (n) => n > 0, 1000)
    vi.advanceTimersByTime(1000)
    expect(await p).toBe(false)
    expect(store.listeners()).toBe(0)
  })
})
