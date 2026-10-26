import { describe, expect, it } from 'vitest'
import { dmUnreadTotal, isHomePath } from './railHome'

describe('isHomePath', () => {
  it('início, amigos e DMs contam como home', () => {
    expect(isHomePath('/')).toBe(true)
    expect(isHomePath('/friends')).toBe(true)
    expect(isHomePath('/dm/abc')).toBe(true)
  })

  it('servidor, convites e propostas não', () => {
    expect(isHomePath('/servers/s1')).toBe(false)
    expect(isHomePath('/invites')).toBe(false)
    expect(isHomePath('/proposals')).toBe(false)
  })
})

describe('dmUnreadTotal', () => {
  it('soma as não lidas das conversas e os pedidos de amizade', () => {
    const unread = { 'conversation:a': 2, 'conversation:b': 1, 'channel:x': 9 }
    expect(dmUnreadTotal([{ id: 'a' }, { id: 'b' }, { id: 'c' }], unread, 3)).toBe(6)
  })

  it('sem nada vale zero', () => {
    expect(dmUnreadTotal([], {}, 0)).toBe(0)
  })
})
