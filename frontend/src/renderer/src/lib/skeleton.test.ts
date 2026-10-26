import { describe, expect, it } from 'vitest'
import { messageSkeletonRows, skeletonWidths } from './skeleton'

describe('skeletonWidths', () => {
  it('devolve a quantidade pedida, dentro do intervalo', () => {
    const widths = skeletonWidths(20, { min: 30, max: 90 })
    expect(widths).toHaveLength(20)
    for (const w of widths) {
      expect(w).toBeGreaterThanOrEqual(30)
      expect(w).toBeLessThanOrEqual(90)
    }
  })

  it('é determinístico: o mesmo seed dá as mesmas larguras', () => {
    expect(skeletonWidths(8, { seed: 3 })).toEqual(skeletonWidths(8, { seed: 3 }))
    expect(skeletonWidths(8, { seed: 3 })).not.toEqual(skeletonWidths(8, { seed: 4 }))
  })

  it('varia as larguras (não são todas iguais)', () => {
    expect(new Set(skeletonWidths(10)).size).toBeGreaterThan(3)
  })

  it('quantidade zero ou negativa dá lista vazia', () => {
    expect(skeletonWidths(0)).toEqual([])
    expect(skeletonWidths(-2)).toEqual([])
  })
})

describe('messageSkeletonRows', () => {
  const rows = messageSkeletonRows(30)

  it('cada linha tem de 1 a 3 barras de texto', () => {
    expect(rows).toHaveLength(30)
    for (const row of rows) {
      expect(row.lines.length).toBeGreaterThanOrEqual(1)
      expect(row.lines.length).toBeLessThanOrEqual(3)
    }
  })

  it('mistura mensagens curtas e longas', () => {
    expect(new Set(rows.map((r) => r.lines.length)).size).toBeGreaterThan(1)
  })

  it('a última barra de cada mensagem é mais curta que a anterior', () => {
    for (const row of rows) {
      if (row.lines.length > 1) {
        expect(row.lines[row.lines.length - 1]).toBeLessThan(row.lines[row.lines.length - 2])
      }
    }
  })

  it('o nome tem largura em pixels dentro do intervalo', () => {
    for (const row of rows) {
      expect(row.namePx).toBeGreaterThanOrEqual(64)
      expect(row.namePx).toBeLessThanOrEqual(150)
    }
  })

  it('é determinístico', () => {
    expect(messageSkeletonRows(6)).toEqual(messageSkeletonRows(6))
  })
})
