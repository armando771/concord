import { describe, expect, it } from 'vitest'
import { conversationRoute, conversationTitle, otherMembers } from './conversations'

const ana = { id: 'a', username: 'ana', display_name: 'Ana' }
const bia = { id: 'b', username: 'bia', display_name: '' }
const caio = { id: 'c', username: 'caio', display_name: 'Caio' }

describe('conversationTitle', () => {
  it('DM 1:1 mostra a outra pessoa', () => {
    expect(conversationTitle({ id: '1', type: 'dm', name: '', members: [ana, bia] }, 'a')).toBe(
      'bia'
    )
  })

  it('grupo com nome usa o nome', () => {
    expect(
      conversationTitle({ id: '1', type: 'group', name: ' Galera ', members: [ana, bia] }, 'a')
    ).toBe('Galera')
  })

  it('grupo sem nome lista os outros', () => {
    expect(
      conversationTitle({ id: '1', type: 'group', name: '', members: [ana, bia, caio] }, 'a')
    ).toBe('bia, Caio')
  })
})

describe('conversationRoute', () => {
  it('DM vai pelo id da pessoa e grupo pelo da conversa', () => {
    expect(conversationRoute({ id: 'x', type: 'dm', name: '', members: [ana, bia] }, 'a')).toBe(
      '/dm/b'
    )
    expect(conversationRoute({ id: 'x', type: 'group', name: '', members: [ana, bia] }, 'a')).toBe(
      '/dm/c/x'
    )
  })
})

it('otherMembers tira você', () => {
  expect(otherMembers({ id: '1', type: 'group', name: '', members: [ana, bia] }, 'a')).toEqual([
    bia
  ])
})
