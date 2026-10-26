import { describe, expect, it } from 'vitest'
import { centerOnPoint } from './dragModifiers'

describe('centerOnPoint', () => {
  it('pegou no canto: desloca metade do card para centralizar no cursor', () => {
    const rect = { left: 100, top: 50, width: 200, height: 80 }
    expect(centerOnPoint({ x: 100, y: 50 }, rect)).toEqual({ x: -100, y: -40 })
  })

  it('pegou no centro: não desloca', () => {
    const rect = { left: 100, top: 50, width: 200, height: 80 }
    expect(centerOnPoint({ x: 200, y: 90 }, rect)).toEqual({ x: 0, y: 0 })
  })
})
