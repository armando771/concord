import { describe, expect, it } from 'vitest'
import { buildPalette, indexPixels } from './gifQuantize'

const px = (...p: number[][]): Uint8ClampedArray => Uint8ClampedArray.from(p.flat())

describe('buildPalette', () => {
  it('imagem de poucas cores mantém cada cor', () => {
    const palette = buildPalette([px([255, 0, 0, 255], [0, 0, 255, 255], [255, 0, 0, 255])])
    expect(palette).toHaveLength(2)
    expect(palette).toContainEqual([255, 0, 0])
    expect(palette).toContainEqual([0, 0, 255])
  })

  it('nunca passa de 255 cores', () => {
    const data = new Uint8ClampedArray(4 * 5000)
    for (let i = 0; i < 5000; i++) {
      data.set([i % 256, (i * 7) % 256, (i * 13) % 256, 255], i * 4)
    }
    expect(buildPalette([data]).length).toBeLessThanOrEqual(255)
  })

  it('ignora pixel transparente', () => {
    expect(buildPalette([px([9, 9, 9, 0], [1, 2, 3, 255])])).toEqual([[1, 2, 3]])
  })
})

describe('indexPixels', () => {
  const palette: [number, number, number][] = [
    [255, 0, 0],
    [0, 0, 255]
  ]

  it('usa o índice da cor mais próxima (a paleta começa em 1)', () => {
    const out = indexPixels(px([250, 10, 0, 255], [10, 0, 240, 255]), palette)
    expect([...out]).toEqual([1, 2])
  })

  it('pixel transparente vira índice 0', () => {
    expect([...indexPixels(px([255, 0, 0, 0]), palette)]).toEqual([0])
  })
})
