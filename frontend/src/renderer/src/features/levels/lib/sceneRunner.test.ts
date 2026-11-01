import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion, runScene } from './sceneRunner'

function fakeCanvas(withCtx = true): HTMLCanvasElement & { calls: string[] } {
  const calls: string[] = []
  const ctx = {
    setTransform: () => calls.push('setTransform'),
    clearRect: () => calls.push('clear')
  }
  return {
    width: 0,
    height: 0,
    dataset: {},
    calls,
    getContext: () => (withCtx ? ctx : null)
  } as unknown as HTMLCanvasElement & { calls: string[] }
}

describe('runScene', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('desenha um quadro por frame até a duração e para sozinha', () => {
    const frames: ((now: number) => void)[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const canvas = fakeCanvas()
    const draw = vi.fn()
    const stop = runScene(canvas, {
      w: 800,
      h: 600,
      durationMs: 1000,
      dpr: 2,
      inCall: true,
      build: () => ({ draw, particles: 42 })
    })
    expect(canvas.width).toBe(800) // na call: 1×
    expect(canvas.dataset.particles).toBe('42')
    frames.shift()!(100)
    frames.shift()!(600)
    expect(draw).toHaveBeenCalledTimes(2)
    expect(draw).toHaveBeenLastCalledWith(expect.anything(), 500)
    frames.shift()!(1200)
    expect(draw).toHaveBeenCalledTimes(2)
    expect(frames).toHaveLength(0) // não pediu outro quadro
    stop()
    expect(canvas.width).toBe(0)
  })

  it('sem contexto 2D não faz nada', () => {
    const build = vi.fn()
    const stop = runScene(fakeCanvas(false), {
      w: 1,
      h: 1,
      durationMs: 1,
      dpr: 1,
      inCall: false,
      build
    })
    stop()
    expect(build).not.toHaveBeenCalled()
  })

  it('prefersReducedMotion lê a preferência do sistema', () => {
    expect(prefersReducedMotion()).toBe(false) // sem window
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    expect(prefersReducedMotion()).toBe(true)
    vi.stubGlobal('window', {})
    expect(prefersReducedMotion()).toBe(false)
  })
})
