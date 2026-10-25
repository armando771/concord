import { describe, expect, it } from 'vitest'
import { resolveReactionPeople } from './reactionPeople'

describe('resolveReactionPeople', () => {
  it('preserva a ordem das reações e aponta quem ainda não tem fonte', () => {
    const { people, missing } = resolveReactionPeople(['bia', 'ana', 'bia'])

    expect(people.map((p) => p.id)).toEqual(['bia', 'ana'])
    expect(missing).toEqual(['bia', 'ana'])
    expect(people[0]).toEqual({
      id: 'bia',
      name: 'Usuário',
      username: undefined,
      avatarUrl: null
    })
  })

  it('perfil público vence o membro do servidor, inclusive avatar removido', () => {
    const { people } = resolveReactionPeople(['u1'], {
      profiles: { u1: { username: 'ana', display_name: 'Ana Nova', avatar_url: null } },
      members: [
        {
          user_id: 'u1',
          username: 'ana-antiga',
          display_name: 'Ana Antiga',
          avatar_url: 'https://cdn/old.png'
        }
      ]
    })

    expect(people[0]).toMatchObject({ name: 'Ana Nova', avatarUrl: null })
  })

  it('usa o apelido do servidor quando há um', () => {
    const { people } = resolveReactionPeople(['u1'], {
      members: [{ user_id: 'u1', username: 'ana', display_name: 'Ana' }],
      nicknames: { u1: 'Aninha' }
    })

    expect(people[0].name).toBe('Aninha')
  })

  it('sem apelido, cai para o nome de exibição e depois para o @', () => {
    const { people, missing } = resolveReactionPeople(['u1', 'u2'], {
      members: [
        { user_id: 'u1', display_name: 'Ana', avatar_url: 'https://cdn/a.png' },
        { user_id: 'u2', username: 'beto' }
      ]
    })

    expect(missing).toEqual([])
    expect(people.map((p) => p.name)).toEqual(['Ana', 'beto'])
    expect(people[0].avatarUrl).toBe('https://cdn/a.png')
  })

  it('resolve amigos e participantes de DM/grupo', () => {
    const { people, missing } = resolveReactionPeople(['f1', 'c1'], {
      friends: [
        { id: 'f1', username: 'bia', display_name: 'Bia', avatar_url: 'https://cdn/b.png' }
      ],
      conversationMembers: [{ id: 'c1', username: 'caio', display_name: 'Caio' }]
    })

    expect(missing).toEqual([])
    expect(people.map((p) => p.name)).toEqual(['Bia', 'Caio'])
    expect(people[0].avatarUrl).toBe('https://cdn/b.png')
  })

  it('resolve a própria pessoa sem buscar perfil', () => {
    const { people, missing } = resolveReactionPeople(['eu'], {
      me: { id: 'eu', username: 'nico', display_name: 'Nico', avatar_url: 'https://cdn/n.png' }
    })

    expect(missing).toEqual([])
    expect(people[0]).toMatchObject({ name: 'Nico', avatarUrl: 'https://cdn/n.png' })
  })
})
