import { describe, expect, it } from 'vitest'
import { clampOffset, clampZoom, coverScale, sourceRect } from './imageCrop'

const square = { width: 300, height: 300 }

describe('coverScale', () => {
  it('a imagem cobre o quadro pelo lado menor', () => {
    expect(coverScale({ width: 600, height: 300 }, square)).toBe(1)
    expect(coverScale({ width: 150, height: 600 }, square)).toBe(2)
  })
})

describe('clampZoom', () => {
  it('fica entre 1 e 3', () => {
    expect(clampZoom(0.5)).toBe(1)
    expect(clampZoom(5)).toBe(3)
    expect(clampZoom(2)).toBe(2)
  })
})

describe('clampOffset', () => {
  it('sem sobra, não arrasta', () => {
    expect(clampOffset({ width: 300, height: 300 }, square, 1, { x: 50, y: -50 })).toEqual({
      x: 0,
      y: 0
    })
  })

  it('paisagem arrasta só na horizontal, até a borda', () => {
    expect(clampOffset({ width: 600, height: 300 }, square, 1, { x: 500, y: 40 })).toEqual({
      x: 150,
      y: 0
    })
  })

  it('com zoom sobra espaço nos dois eixos', () => {
    expect(clampOffset({ width: 300, height: 300 }, square, 2, { x: -500, y: 500 })).toEqual({
      x: -150,
      y: 150
    })
  })
})

describe('sourceRect', () => {
  it('zoom 1 e imagem quadrada: a imagem inteira', () => {
    expect(sourceRect({ width: 1000, height: 1000 }, square, 1, { x: 0, y: 0 })).toEqual({
      sx: 0,
      sy: 0,
      sw: 1000,
      sh: 1000
    })
  })

  it('paisagem centralizada corta as laterais', () => {
    expect(sourceRect({ width: 2000, height: 1000 }, square, 1, { x: 0, y: 0 })).toEqual({
      sx: 500,
      sy: 0,
      sw: 1000,
      sh: 1000
    })
  })

  it('arrastar para a direita mostra o lado esquerdo', () => {
    const rect = sourceRect({ width: 2000, height: 1000 }, square, 1, { x: 150, y: 0 })
    expect(rect.sx).toBe(0)
  })

  it('zoom 2 pega a metade do meio', () => {
    expect(sourceRect({ width: 1000, height: 1000 }, square, 2, { x: 0, y: 0 })).toEqual({
      sx: 250,
      sy: 250,
      sw: 500,
      sh: 500
    })
  })

  it('banner retrato: corta em cima e embaixo', () => {
    const rect = sourceRect({ width: 680, height: 1000 }, { width: 340, height: 120 }, 1, {
      x: 0,
      y: 0
    })
    expect(rect.sw).toBeCloseTo(680)
    expect(rect.sh).toBeCloseTo(240)
    expect(rect.sy).toBeCloseTo(380)
  })
})
