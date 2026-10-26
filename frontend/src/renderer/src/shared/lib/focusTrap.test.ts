import { describe, expect, it } from 'vitest'
import { wrapFocusIndex } from './focusTrap'

describe('wrapFocusIndex', () => {
  it('Tab no último volta para o primeiro; Shift+Tab no primeiro vai para o último', () => {
    expect(wrapFocusIndex(2, 3, false)).toBe(0)
    expect(wrapFocusIndex(0, 3, true)).toBe(2)
  })

  it('no meio, o navegador cuida', () => {
    expect(wrapFocusIndex(1, 3, false)).toBeNull()
    expect(wrapFocusIndex(1, 3, true)).toBeNull()
  })

  it('foco fora do diálogo entra pela ponta certa', () => {
    expect(wrapFocusIndex(-1, 3, false)).toBe(0)
    expect(wrapFocusIndex(-1, 3, true)).toBe(2)
  })

  it('sem nada focável, nada a fazer', () => {
    expect(wrapFocusIndex(-1, 0, false)).toBeNull()
  })
})
