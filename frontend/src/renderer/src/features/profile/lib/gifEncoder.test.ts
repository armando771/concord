import { describe, expect, it } from 'vitest'
import { encodeGif } from './gifEncoder'
import { decodeGif } from './gifTestDecoder'

const palette: [number, number, number][] = [
  [255, 0, 0],
  [0, 255, 0]
]

/** Como os índices aparecem na tela (0 = transparente). */
function rgbaOf(indices: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(indices.length * 4)
  indices.forEach((index, i) => {
    if (index !== 0) out.set([...(palette[index - 1] ?? [0, 0, 0]), 255], i * 4)
  })
  return out
}

/** Quantos bytes o GIF gasta só com os quadros (sem cabeçalho e paleta). */
const headerBytes = encodeGif({ width: 1, height: 1, palette, frames: [] }).length

describe('encodeGif', () => {
  it('escreve cabeçalho, tamanho, laço infinito e trailer', () => {
    const bytes = encodeGif({
      width: 3,
      height: 2,
      palette,
      frames: [{ indices: new Uint8Array(6), delayMs: 100 }]
    })
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a')
    expect([bytes[6], bytes[7], bytes[8], bytes[9]]).toEqual([3, 0, 2, 0])
    expect(new TextDecoder().decode(bytes)).toContain('NETSCAPE2.0')
    expect(bytes[bytes.length - 1]).toBe(0x3b)
  })

  it('preserva os quadros, a ordem e o atraso de cada um', () => {
    const a = Uint8Array.from([1, 2, 1, 2, 1, 2])
    const b = Uint8Array.from([2, 2, 2, 1, 1, 1])
    const bytes = encodeGif({
      width: 3,
      height: 2,
      palette,
      frames: [
        { indices: a, delayMs: 40 },
        { indices: b, delayMs: 120 }
      ]
    })
    const { frames } = decodeGif(bytes)
    expect(frames).toHaveLength(2)
    expect(frames[0]).toEqual({ delay: 40, rgba: rgbaOf(a) })
    expect(frames[1]).toEqual({ delay: 120, rgba: rgbaOf(b) })
  })

  it('sobrevive a uma imagem grande que enche a tabela do LZW', () => {
    const w = 64
    const h = 64
    const indices = new Uint8Array(w * h).map((_, i) => (i * 7 + (i >> 3)) % 200)
    const bytes = encodeGif({ width: w, height: h, palette, frames: [{ indices, delayMs: 50 }] })
    expect(decodeGif(bytes).frames[0].rgba).toEqual(rgbaOf(indices))
  })

  it('atraso mínimo de 20 ms (navegadores aceleram abaixo disso)', () => {
    const bytes = encodeGif({
      width: 1,
      height: 1,
      palette,
      frames: [{ indices: Uint8Array.from([1]), delayMs: 0 }]
    })
    expect(decodeGif(bytes).frames[0].delay).toBe(20)
  })

  it('quadro que muda pouco grava só o retângulo alterado (regressão: GIF inflava)', () => {
    const w = 64
    const h = 64
    const background = new Uint8Array(w * h).map((_, i) => 1 + ((i * 7 + (i >> 3)) % 200))
    const frames = Array.from({ length: 30 }, (_, n) => {
      const indices = background.slice()
      for (let y = 0; y < 4; y++) indices.fill(201, (n + y) * w + n, (n + y) * w + n + 4)
      return { indices, delayMs: 50 }
    })
    const bytes = encodeGif({ width: w, height: h, palette, frames })
    const one = encodeGif({ width: w, height: h, palette, frames: [frames[0]] }).length
    expect(bytes.length - headerBytes).toBeLessThan(2 * (one - headerBytes))
    expect(decodeGif(bytes).frames.map((f) => f.rgba)).toEqual(
      frames.map((f) => rgbaOf(f.indices))
    )
  })

  it('quadro repetido não grava nada além do atraso', () => {
    const indices = Uint8Array.from([1, 2, 1, 2])
    const frame = { indices, delayMs: 50 }
    const bytes = encodeGif({ width: 2, height: 2, palette, frames: [frame, frame, frame] })
    const { frames } = decodeGif(bytes)
    expect(frames.map((f) => f.rgba)).toEqual([rgbaOf(indices), rgbaOf(indices), rgbaOf(indices)])
  })

  it('com transparência, pixel que some volta a ser transparente', () => {
    const a = Uint8Array.from([1, 1, 2, 2])
    const b = Uint8Array.from([0, 1, 2, 0])
    const bytes = encodeGif({
      width: 2,
      height: 2,
      palette,
      frames: [
        { indices: a, delayMs: 50 },
        { indices: b, delayMs: 50 }
      ]
    })
    expect(decodeGif(bytes).frames.map((f) => f.rgba)).toEqual([rgbaOf(a), rgbaOf(b)])
  })
})
