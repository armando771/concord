import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clamp01,
  drawGlow,
  easeIn,
  easeInOut,
  easeOut,
  easeOutBack,
  hexA,
  prog,
  rng,
  sparkle,
  window4
} from './sceneKit'

/** Contexto de canvas que só anota as chamadas (o teste roda sem DOM). */
function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = []
  const gradient = { addColorStop: (): void => {} }
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target, {
    get: (t, key: string) =>
      key in t
        ? t[key]
        : (): unknown => {
            calls.push(key)
            return gradient
          },
    set: (t, key: string, value) => {
      t[key] = value
      return true
    }
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

describe('sceneKit', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rng com a mesma semente repete a sequência, entre 0 e 1', () => {
    const a = rng(42)
    const b = rng(42)
    const seq = Array.from({ length: 20 }, () => a())
    expect(seq).toEqual(Array.from({ length: 20 }, () => b()))
    for (const v of seq) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of seq) expect(v).toBeLessThan(1)
  })

  it('curvas de tempo saem de 0 e chegam a 1', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(prog(50, 0, 100)).toBe(0.5)
    for (const ease of [easeOut, easeIn, easeInOut, easeOutBack]) {
      expect(ease(0)).toBeCloseTo(0)
      expect(ease(1)).toBeCloseTo(1)
    }
    expect(easeInOut(0.25)).toBeLessThan(0.25)
    expect(easeInOut(0.75)).toBeGreaterThan(0.75)
    expect(window4(50, 0, 10, 80, 100)).toBe(1)
    expect(window4(90, 0, 10, 80, 100)).toBeCloseTo(0.5)
  })

  it('hexA aceita #rgb e #rrggbb', () => {
    expect(hexA('#fff', 0.5)).toBe('rgba(255,255,255,0.500)')
    expect(hexA('#ff0000', 2)).toBe('rgba(255,0,0,1.000)')
  })

  it('drawGlow e sparkle desenham, e não desenham nada invisível', () => {
    const sprite = { width: 0, height: 0, getContext: () => fakeCtx().ctx }
    vi.stubGlobal('document', { createElement: () => sprite })
    const { ctx, calls } = fakeCtx()
    drawGlow(ctx, '#123456', 10, 10, 5, 0.5)
    drawGlow(ctx, '#123456', 10, 10, 5, 0)
    sparkle(ctx, 0, 0, 4, '#fff', 1)
    sparkle(ctx, 0, 0, 4, '#fff', 0)
    expect(calls.filter((c) => c === 'drawImage')).toHaveLength(1)
    expect(calls.filter((c) => c === 'fill')).toHaveLength(1)
  })
})
