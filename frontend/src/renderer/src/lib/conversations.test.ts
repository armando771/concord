import { describe, expect, it } from 'vitest'
import {
  conversationRoute,
  conversationTitle,
  otherMembers,
  sanitizeConversations
} from './conversations'

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

describe('sanitizeConversations', () => {
  it('resposta que não é lista vira lista vazia', () => {
    expect(sanitizeConversations(null)).toEqual([])
    expect(sanitizeConversations({ error: 'x' })).toEqual([])
  })

  it('tira linhas null ou sem id e membros inválidos', () => {
    const out = sanitizeConversations([
      null,
      { type: 'dm' },
      { id: 'g', type: 'group', name: 'Galera', members: [ana, null, { username: 'x' }] }
    ])
    expect(out.map((c) => c.id)).toEqual(['g'])
    expect(out[0].members).toEqual([ana])
  })

  it('grupo sem other_user nem members não quebra título nem rota', () => {
    const [g] = sanitizeConversations([{ id: 'g', type: 'group' }])
    expect(g.members).toEqual([])
    expect(g.other_user).toBeUndefined()
    expect(conversationTitle(g, 'a')).toBe('Grupo sem nome')
    expect(conversationRoute(g, 'a')).toBe('/dm/c/g')
  })

  it('DM com other_user sem id cai na rota da conversa', () => {
    const [dm] = sanitizeConversations([{ id: 'x', other_user: {} }])
    expect(dm.type).toBe('dm')
    expect(dm.other_user).toBeUndefined()
    expect(conversationTitle(dm, 'a')).toBe('Mensagem direta')
    expect(conversationRoute(dm, 'a')).toBe('/dm/c/x')
  })

  it('mantém DM válida como veio', () => {
    const [dm] = sanitizeConversations([
      { id: 'x', type: 'dm', name: '', other_user: bia, members: [ana, bia], unread_count: 3 }
    ])
    expect(dm.other_user).toEqual(bia)
    expect(dm.unread_count).toBe(3)
    expect(conversationRoute(dm, 'a')).toBe('/dm/b')
  })
})
