import { describe, expect, it } from 'vitest'
import { cropGif, MAX_GIF_FRAMES, type SourceFrame } from './gifCrop'

const rect = { sx: 1, sy: 2, sw: 3, sh: 4 }
const out = { width: 2, height: 2 }

async function* source(...delays: number[]): AsyncGenerator<SourceFrame> {
  for (const [i, durationMs] of delays.entries()) {
    yield { image: { id: i } as unknown as CanvasImageSource, durationMs }
  }
}

/** "Desenha" um quadro de uma cor só, conforme o número do quadro. */
const draw = (image: CanvasImageSource): Uint8ClampedArray => {
  const id = (image as unknown as { id: number }).id
  const pixel = [id === 0 ? 255 : 0, 0, id === 0 ? 0 : 255, 255]
  return Uint8ClampedArray.from(Array.from({ length: 4 }, () => pixel).flat())
}

describe('cropGif', () => {
  it('gera um GIF com todos os quadros, no tamanho de saída', async () => {
    const bytes = await cropGif(source(50, 80, 30), rect, out, draw)
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a')
    expect([bytes[6], bytes[8]]).toEqual([2, 2])
    const controls = bytes.reduce((n, b, i) => n + (b === 0x21 && bytes[i + 1] === 0xf9 ? 1 : 0), 0)
    expect(controls).toBe(3)
  })

  it('repassa o retângulo de origem e a saída para o desenho', async () => {
    const seen: unknown[] = []
    await cropGif(source(10), rect, out, (img, r, o) => {
      seen.push(r, o)
      return draw(img)
    })
    expect(seen).toEqual([rect, out])
  })

  it('recusa GIF com quadros demais', async () => {
    await expect(
      cropGif(source(...Array(MAX_GIF_FRAMES + 1).fill(20)), rect, out, draw)
    ).rejects.toThrow(/quadros/)
  })

  it('recusa GIF sem quadros', async () => {
    await expect(cropGif(source(), rect, out, draw)).rejects.toThrow()
  })
})
