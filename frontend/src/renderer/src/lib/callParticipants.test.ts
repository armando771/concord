import { describe, expect, it } from 'vitest'
import { mergeCallPeople } from './callParticipants'

const ana = { id: 'ana', username: 'ana', display_name: 'Ana' }

describe('mergeCallPeople', () => {
  it('inclui quem está só na sala de mídia, com o nome do LiveKit', () => {
    const people = mergeCallPeople([ana], { ana: 'Ana', bia: 'Bia' }, 'eu')
    expect(people.map((p) => [p.id, p.display_name])).toEqual([
      ['ana', 'Ana'],
      ['bia', 'Bia']
    ])
  })

  it('não duplica o próprio usuário', () => {
    expect(mergeCallPeople([], { eu: 'Eu' }, 'eu')).toEqual([])
  })

  it('usa resolveName quando o LiveKit não tem nome', () => {
    const people = mergeCallPeople([], { bia: '' }, 'eu', (id) =>
      id === 'bia' ? 'Bia do servidor' : undefined
    )
    expect(people[0].display_name).toBe('Bia do servidor')
  })

  it('corrige "Usuário" vindo do backend quando há nome melhor', () => {
    const people = mergeCallPeople(
      [{ id: 'bia', username: '', display_name: 'Usuário' }],
      { bia: 'Bia' },
      'eu'
    )
    expect(people[0].display_name).toBe('Bia')
  })

  it('cai em "Usuário" só sem nenhuma fonte de nome', () => {
    expect(mergeCallPeople([], { bia: '' }, 'eu')[0].display_name).toBe('Usuário')
  })

  it('mantém quem está no backend mas ainda não conectou a mídia', () => {
    expect(mergeCallPeople([ana], {}, 'eu')).toEqual([ana])
  })
})
