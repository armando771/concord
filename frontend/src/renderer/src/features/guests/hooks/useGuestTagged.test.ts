import { describe, expect, it } from 'vitest'
import { guestTagged } from './useGuestTagged'

describe('nome do visitante no tile', () => {
  const ana = { id: 'a', username: 'ana', display_name: 'Ana', name_style: { font: 'x' } as never }
  it('ganha o selo Visitante (sem estilo de nome)', () => {
    expect(guestTagged(ana, true)).toMatchObject({
      display_name: 'Ana · Visitante',
      name_style: null
    })
  })
  it('membro fica igual', () => {
    expect(guestTagged(ana, false)).toBe(ana)
  })
})
