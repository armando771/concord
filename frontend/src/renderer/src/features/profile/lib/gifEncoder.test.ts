import { describe, expect, it } from 'vitest'
import { encodeGif } from './gifEncoder'

/** Decodificador LZW mínimo, só para conferir o que o encoder escreveu. */
function lzwDecode(minCode: number, data: number[], total: number): number[] {
  const clear = 1 << minCode
  const end = clear + 1
  let table: number[][] = []
  const reset = (): void => {
    table = []
    for (let i = 0; i < clear; i++) table.push([i])
    table.push([], [])
  }
  reset()
  let size = minCode + 1
  let bits = 0
  let acc = 0
  let pos = 0
  let prev: number[] | null = null
  const out: number[] = []
  while (out.length < total) {
    while (bits < size) {
      acc |= data[pos++] << bits
      bits += 8
    }
    const code = acc & ((1 << size) - 1)
    acc >>= size
    bits -= size
    if (code === clear) {
      reset()
      size = minCode + 1
      prev = null
      continue
    }
    if (code === end) break
    const entry: number[] = code < table.length ? table[code] : [...prev!, prev![0]]
    out.push(...entry)
    if (prev) table.push([...prev, entry[0]])
    if (table.length === 1 << size && size < 12) size++
    prev = entry
  }
  return out
}

/** Lê os quadros do GIF: atraso e índices decodificados. */
function readFrames(bytes: Uint8Array): { delay: number; indices: number[] }[] {
  let pos = 13 + 3 * 256
  const frames: { delay: number; indices: number[] }[] = []
  let delay = 0
  let width = bytes[6] | (bytes[7] << 8)
  let height = bytes[8] | (bytes[9] << 8)
  while (bytes[pos] !== 0x3b) {
    if (bytes[pos] === 0x21) {
      if (bytes[pos + 1] === 0xf9) delay = (bytes[pos + 4] | (bytes[pos + 5] << 8)) * 10
      pos += 2
      while (bytes[pos] !== 0) pos += bytes[pos] + 1
      pos++
    } else {
      pos += 10
      const minCode = bytes[pos++]
      const data: number[] = []
      while (bytes[pos] !== 0) {
        data.push(...bytes.slice(pos + 1, pos + 1 + bytes[pos]))
        pos += bytes[pos] + 1
      }
      pos++
      frames.push({ delay, indices: lzwDecode(minCode, data, width * height) })
    }
  }
  return frames
}

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
