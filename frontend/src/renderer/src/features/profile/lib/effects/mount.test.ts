import { describe, expect, it, vi } from 'vitest'
import { browserEnv } from './browserEnv'
import { fakeCtx, type FakeCtx } from './fakeCtx'
import { seededRand } from './index'
import { mountEffect, type MountEnv } from './mount'
import type { Scene } from './types'

const scene: Scene<{ n: number }> = {
  init: () => ({ n: 0 }),
  step: (s) => {
    s.n++
  },
  draw: () => {}
}

interface FakeCanvas {
  width: number
  height: number
  clientWidth: number
  clientHeight: number
  getContext: () => FakeCtx | null
}

interface Callbacks {
  size: ((w: number, h: number) => void) | null
  visible: ((v: boolean) => void) | null
  page: ((hidden: boolean) => void) | null
}

function fakeCanvas(ctx: FakeCtx | null, w = 300, h = 400): FakeCanvas {
  return { width: 0, height: 0, clientWidth: w, clientHeight: h, getContext: () => ctx }
}

function fakeEnv(over: Partial<MountEnv> = {}): {
  env: MountEnv
  cbs: Callbacks
  offs: ReturnType<typeof vi.fn>
} {
  const cbs: Callbacks = { size: null, visible: null, page: null }
  const offs = vi.fn()
  const env: MountEnv = {
    raf: vi.fn(() => 1),
    caf: vi.fn(),
    dpr: 3,
    observeSize: (_el, cb) => ((cbs.size = cb), offs),
    observeVisible: (_el, cb) => ((cbs.visible = cb), offs),
    pageHidden: () => false,
    watchPage: (cb) => ((cbs.page = cb), offs),
    reducedMotion: () => false,
    ...over
  }
  return { env, cbs, offs }
}

function mount(canvas: FakeCanvas, env: MountEnv): () => void {
  return mountEffect(canvas as unknown as HTMLCanvasElement, {
    scene: scene as Scene,
    params: { density: 1, speed: 1, color: '#ffffff' },
    env,
    rand: seededRand(1)
  })
}

describe('mountEffect', () => {
  it('ajusta o canvas ao tamanho com dpr limitado a 1,5 e começa a animar', () => {
    const ctx = fakeCtx()
    const canvas = fakeCanvas(ctx)
    const { env, cbs } = fakeEnv()
    mount(canvas, env)
    expect([canvas.width, canvas.height]).toEqual([450, 600])
    expect(ctx.calls).toContain('setTransform')
    expect(env.raf).toHaveBeenCalledTimes(1)
    cbs.size?.(200, 100)
    expect([canvas.width, canvas.height]).toEqual([300, 150])
    cbs.size?.(0, 100)
    expect(canvas.width).toBe(300)
  })

  it('pausa fora da tela e com a aba escondida, e volta depois', () => {
    const { env, cbs } = fakeEnv()
    mount(fakeCanvas(fakeCtx()), env)
    cbs.visible?.(false)
    expect(env.caf).toHaveBeenCalledTimes(1)
    cbs.visible?.(true)
    expect(env.raf).toHaveBeenCalledTimes(2)
    cbs.page?.(true)
    expect(env.caf).toHaveBeenCalledTimes(2)
    cbs.page?.(false)
    expect(env.raf).toHaveBeenCalledTimes(3)
  })

  it('não anima com a aba já escondida', () => {
    const { env } = fakeEnv({ pageHidden: () => true })
    mount(fakeCanvas(fakeCtx()), env)
    expect(env.raf).not.toHaveBeenCalled()
  })

  it('menos movimento: desenha um quadro parado e não usa o rAF', () => {
    const ctx = fakeCtx()
    const { env, cbs } = fakeEnv({ reducedMotion: () => true })
    mount(fakeCanvas(ctx), env)
    cbs.visible?.(true)
    expect(env.raf).not.toHaveBeenCalled()
    expect(ctx.calls.filter((c) => c === 'clearRect')).toHaveLength(1)
    cbs.size?.(280, 500)
    expect(ctx.calls.filter((c) => c === 'clearRect')).toHaveLength(2)
  })

  it('a limpeza para o laço e desliga os observadores', () => {
    const { env, offs } = fakeEnv()
    const off = mount(fakeCanvas(fakeCtx(), 0, 0), env)
    off()
    expect(env.caf).toHaveBeenCalledTimes(1)
    expect(offs).toHaveBeenCalledTimes(3)
  })

  it('sem contexto 2D não faz nada', () => {
    const { env } = fakeEnv()
    const off = mount(fakeCanvas(null), env)
    expect(env.raf).not.toHaveBeenCalled()
    expect(() => off()).not.toThrow()
  })
})

describe('browserEnv', () => {
  it('sem as APIs do navegador (node) não observa nada e não quebra', () => {
    const env = browserEnv()
    const el = {} as Element
    expect(env.dpr).toBe(1)
    expect(env.reducedMotion()).toBe(false)
    expect(env.pageHidden()).toBe(false)
    expect(() => env.observeSize(el, () => {})()).not.toThrow()
    expect(() => env.observeVisible(el, () => {})()).not.toThrow()
    expect(() => env.watchPage(() => {})()).not.toThrow()
  })
})
