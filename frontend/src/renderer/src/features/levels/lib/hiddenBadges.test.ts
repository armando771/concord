import { describe, expect, it } from 'vitest'
import { hiddenBadgesTitle } from './hiddenBadges'

describe('hiddenBadgesTitle', () => {
  it('plural a partir de 2', () => {
    expect(hiddenBadgesTitle(12)).toBe('12 badges ocultos restantes')
    expect(hiddenBadgesTitle(2)).toBe('2 badges ocultos restantes')
  })

  it('singular com 1', () => {
    expect(hiddenBadgesTitle(1)).toBe('1 badge oculto restante')
  })

  it('0, ausente ou inválido: nada para mostrar', () => {
    expect(hiddenBadgesTitle(0)).toBeNull()
    expect(hiddenBadgesTitle(undefined)).toBeNull()
    expect(hiddenBadgesTitle(-3)).toBeNull()
  })
})
