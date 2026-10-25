import { describe, expect, it } from 'vitest'
import { CANVAS_MAX_PIXELS, canvasScale } from './canvasBudget'

const pixels = (w: number, h: number, scale: number): number => w * scale * (h * scale)

describe('canvasScale (resolução do canvas dos marcos)', () => {
  it('tela comum: segue o devicePixelRatio até 1,5', () => {
    expect(canvasScale({ dpr: 1, w: 1280, h: 720, inCall: false })).toBe(1)
    expect(canvasScale({ dpr: 1.25, w: 1024, h: 640, inCall: false })).toBe(1.25)
    expect(canvasScale({ dpr: 3, w: 800, h: 500, inCall: false })).toBe(1.5)
  })

  it('nunca passa de ~2 MP, nem em 4K a 150% ou ultrawide', () => {
    for (const [w, h, dpr] of [
      [2560, 1440, 1.5],
      [3840, 2160, 1],
      [5120, 1440, 1],
      [1920, 1080, 2],
      [7680, 4320, 1]
    ]) {
      const scale = canvasScale({ dpr, w, h, inCall: false })
      expect(pixels(w, h, scale)).toBeLessThanOrEqual(CANVAS_MAX_PIXELS * 1.0001)
      expect(scale).toBeGreaterThan(0)
    }
    expect(CANVAS_MAX_PIXELS).toBe(2_000_000)
  })

  it('em call: 1× (e ainda dentro do limite de área)', () => {
    expect(canvasScale({ dpr: 2, w: 1280, h: 720, inCall: true })).toBe(1)
    expect(canvasScale({ dpr: 1.5, w: 1440, h: 900, inCall: true })).toBe(1)
    const big = canvasScale({ dpr: 1.5, w: 3840, h: 2160, inCall: true })
    expect(big).toBeLessThan(1)
    expect(pixels(3840, 2160, big)).toBeLessThanOrEqual(CANVAS_MAX_PIXELS * 1.0001)
  })

  it('valores estranhos não quebram (dpr ausente, janela zerada)', () => {
    expect(canvasScale({ dpr: 0, w: 1280, h: 720, inCall: false })).toBe(1)
    expect(canvasScale({ dpr: Number.NaN, w: 1280, h: 720, inCall: false })).toBe(1)
    expect(canvasScale({ dpr: 2, w: 0, h: 0, inCall: false })).toBe(1.5)
  })
})
