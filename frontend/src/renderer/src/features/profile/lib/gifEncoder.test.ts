import { describe, expect, it } from 'vitest'
import { encodeGif } from './gifEncoder'
import { readFrames } from './gifTestDecoder'

const palette: [number, number, number][] = [
  [255, 0, 0],
  [0, 255, 0]
]

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
    const frames = readFrames(bytes)
    expect(frames).toHaveLength(2)
    expect(frames[0]).toEqual({ delay: 40, indices: [...a] })
    expect(frames[1]).toEqual({ delay: 120, indices: [...b] })
  })

  it('sobrevive a uma imagem grande que enche a tabela do LZW', () => {
    const w = 64
    const h = 64
    const indices = new Uint8Array(w * h).map((_, i) => (i * 7 + (i >> 3)) % 200)
    const bytes = encodeGif({ width: w, height: h, palette, frames: [{ indices, delayMs: 50 }] })
    expect(readFrames(bytes)[0].indices).toEqual([...indices])
  })

  it('atraso mínimo de 20 ms (navegadores aceleram abaixo disso)', () => {
    const bytes = encodeGif({
      width: 1,
      height: 1,
      palette,
      frames: [{ indices: Uint8Array.from([1]), delayMs: 0 }]
    })
    expect(readFrames(bytes)[0].delay).toBe(20)
  })
})
