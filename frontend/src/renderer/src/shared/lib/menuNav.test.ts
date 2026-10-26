import { describe, expect, it } from 'vitest'
import { nextMenuIndex } from './menuNav'

describe('nextMenuIndex', () => {
  it('setas andam e dão a volta', () => {
    expect(nextMenuIndex(0, 3, 'ArrowDown')).toBe(1)
    expect(nextMenuIndex(2, 3, 'ArrowDown')).toBe(0)
    expect(nextMenuIndex(0, 3, 'ArrowUp')).toBe(2)
    expect(nextMenuIndex(1, 3, 'ArrowUp')).toBe(0)
  })

  it('Home e End vão para as pontas', () => {
    expect(nextMenuIndex(1, 4, 'Home')).toBe(0)
    expect(nextMenuIndex(1, 4, 'End')).toBe(3)
  })

  it('sem foco num item: seta para baixo vai ao primeiro, para cima ao último', () => {
    expect(nextMenuIndex(-1, 3, 'ArrowDown')).toBe(0)
    expect(nextMenuIndex(-1, 3, 'ArrowUp')).toBe(2)
  })

  it('outras teclas ou menu vazio: nada', () => {
    expect(nextMenuIndex(0, 3, 'a')).toBeNull()
    expect(nextMenuIndex(-1, 0, 'ArrowDown')).toBeNull()
  })
})
