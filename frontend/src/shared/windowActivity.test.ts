import { describe, expect, it } from 'vitest'
import { ACTIVE_WINDOW, inBackground, parseWindowActivity, sameActivity } from './windowActivity'

describe('windowActivity', () => {
  it('aceita só os dois booleanos', () => {
    expect(parseWindowActivity({ focused: false, visible: true })).toEqual({
      focused: false,
      visible: true
    })
    expect(parseWindowActivity({ focused: 'sim', visible: true })).toBeNull()
    expect(parseWindowActivity(null)).toBeNull()
    expect(parseWindowActivity('x')).toBeNull()
  })

  it('compara pelos campos', () => {
    expect(sameActivity(ACTIVE_WINDOW, { focused: true, visible: true })).toBe(true)
    expect(sameActivity(ACTIVE_WINDOW, { focused: false, visible: true })).toBe(false)
  })

  it('segundo plano = sem foco ou fora da tela', () => {
    expect(inBackground(ACTIVE_WINDOW)).toBe(false)
    expect(inBackground({ focused: false, visible: true })).toBe(true)
    expect(inBackground({ focused: false, visible: false })).toBe(true)
  })
})
