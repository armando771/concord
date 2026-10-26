import { describe, expect, it } from 'vitest'
import {
  confidenceToAlpha,
  coverRect,
  dataUrlToBytes,
  erodeMask,
  processingSize,
  smoothMask,
  PROCESS_MAX_PIXELS
} from './segmentation'

describe('confidenceToAlpha', () => {
  it('baixa confiança some, alta fica opaca, o meio é gradual', () => {
    const conf = new Float32Array([0, 0.2, 0.5, 0.8, 1])
    const out = new Uint8ClampedArray(conf.length * 4)
    confidenceToAlpha(conf, out)
    const alpha = [0, 1, 2, 3, 4].map((i) => out[i * 4 + 3])
    expect(alpha[0]).toBe(0)
    expect(alpha[4]).toBe(255)
    expect(alpha[2]).toBeGreaterThan(alpha[1])
    expect(alpha[3]).toBeGreaterThan(alpha[2])
    expect(alpha[1]).toBeLessThan(40)
    expect(alpha[3]).toBeGreaterThan(215)
  })
  it('é monotônica e preenche só o canal alfa', () => {
    const conf = Float32Array.from({ length: 101 }, (_, i) => i / 100)
    const out = new Uint8ClampedArray(conf.length * 4)
    confidenceToAlpha(conf, out)
    for (let i = 1; i < conf.length; i++)
      expect(out[i * 4 + 3]).toBeGreaterThanOrEqual(out[(i - 1) * 4 + 3])
    expect([out[0], out[1], out[2]]).toEqual([0, 0, 0])
  })
  it('ignora valores fora de 0..1', () => {
    const out = new Uint8ClampedArray(8)
    confidenceToAlpha(new Float32Array([-3, 7]), out)
    expect([out[3], out[7]]).toEqual([0, 255])
  })
})

describe('erodeMask', () => {
  const erode = (src: number[], w: number, h: number): number[] => {
    const dst = new Float32Array(src.length)
    erodeMask(Float32Array.from(src), dst, w, h)
    return [...dst]
  }

  it('encolhe a pessoa em 1 px em volta', () => {
    // 5x5 com um bloco 3x3 de pessoa no meio: sobra só o centro
    const src = [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]
    expect(erode(src, 5, 5)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ])
  })
  it('máscara toda de pessoa continua inteira (inclusive nos cantos)', () => {
    expect(erode(Array(9).fill(1), 3, 3)).toEqual(Array(9).fill(1))
  })
  it('máscara só de fundo continua zerada', () => {
    expect(erode(Array(9).fill(0), 3, 3)).toEqual(Array(9).fill(0))
  })
  it('ponto isolado some', () => {
    const src = Array(25).fill(0)
    src[12] = 1
    expect(erode(src, 5, 5)).toEqual(Array(25).fill(0))
  })
  it('mantém os valores intermediários da borda (o menor da vizinhança)', () => {
    expect(erode([0.2, 0.9, 0.9, 0.9], 2, 2)).toEqual([
      expect.closeTo(0.2),
      expect.closeTo(0.2),
      expect.closeTo(0.2),
      expect.closeTo(0.2)
    ])
  })
})

describe('smoothMask', () => {
  it('mistura a máscara nova com a anterior (menos tremida)', () => {
    const prev = new Float32Array([0, 1])
    smoothMask(prev, new Float32Array([1, 0]), 0.5)
    expect([...prev]).toEqual([0.5, 0.5])
  })
  it('alpha 1 copia a nova; alpha 0 mantém a anterior', () => {
    const a = new Float32Array([0.2])
    smoothMask(a, new Float32Array([0.9]), 1)
    expect(a[0]).toBeCloseTo(0.9)
    smoothMask(a, new Float32Array([0.1]), 0)
    expect(a[0]).toBeCloseTo(0.9)
  })
  it('tamanho diferente: copia a nova sem quebrar', () => {
    const prev = new Float32Array(2)
    const next = smoothMask(prev, new Float32Array([1, 1, 1]), 0.5)
    expect([...next]).toEqual([1, 1, 1])
  })
})

describe('coverRect', () => {
  it('imagem mais larga: corta os lados, centralizada', () => {
    expect(coverRect(2000, 1000, 1000, 1000)).toEqual({ x: -500, y: 0, w: 2000, h: 1000 })
  })
  it('imagem mais alta: corta em cima e embaixo', () => {
    expect(coverRect(1000, 2000, 1000, 1000)).toEqual({ x: 0, y: -500, w: 1000, h: 2000 })
  })
  it('mesma proporção: ocupa tudo', () => {
    expect(coverRect(1280, 720, 640, 360)).toEqual({ x: 0, y: 0, w: 640, h: 360 })
  })
  it('imagem inválida: preenche sem dividir por zero', () => {
    expect(coverRect(0, 0, 100, 50)).toEqual({ x: 0, y: 0, w: 100, h: 50 })
  })
})

describe('processingSize', () => {
  it('mantém câmeras pequenas', () => {
    expect(processingSize(640, 360)).toEqual({ width: 640, height: 360 })
  })
  it('reduz 720p para caber no orçamento, mantendo a proporção', () => {
    const { width, height } = processingSize(1280, 720)
    expect(width * height).toBeLessThanOrEqual(PROCESS_MAX_PIXELS + width + height)
    expect(width / height).toBeCloseTo(16 / 9, 1)
  })
  it('dimensões inválidas caem num tamanho padrão', () => {
    expect(processingSize(0, 0)).toEqual({ width: 640, height: 360 })
  })
})

describe('dataUrlToBytes', () => {
  it('decodifica base64', () => {
    expect([...dataUrlToBytes('data:application/octet-stream;base64,AQID')]).toEqual([1, 2, 3])
  })
  it('rejeita o que não é data URL base64', () => {
    expect(() => dataUrlToBytes('http://x')).toThrow()
  })
})
