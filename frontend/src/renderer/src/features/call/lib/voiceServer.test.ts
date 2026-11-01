import { describe, expect, it } from 'vitest'
import { voicePeople, voiceServerId } from './voiceServer'

describe('voiceServerId', () => {
  it('sem chamada não há servidor', () => {
    expect(voiceServerId({ status: 'idle', type: 'channel', serverId: 's1' })).toBeNull()
  })

  it('chamada de canal devolve o servidor', () => {
    expect(voiceServerId({ status: 'active', type: 'channel', serverId: 's1' })).toBe('s1')
  })

  it('chamada de DM não marca servidor', () => {
    expect(voiceServerId({ status: 'active', type: 'dm', serverId: null })).toBeNull()
  })

  it('canal sem servidor devolve null', () => {
    expect(voiceServerId({ status: 'active', type: 'channel', serverId: null })).toBeNull()
  })
})

const part = (user_id: string, extra: Record<string, unknown> = {}) => ({
  call_id: 'c1',
  role: 'member' as const,
  joined_at: '',
  user_id,
  ...extra
})

describe('voicePeople', () => {
  it('sem canais ou com canais vazios não há ninguém', () => {
    expect(voicePeople([])).toEqual([])
    expect(voicePeople([{ participants: [] }])).toEqual([])
  })

  it('junta quem está em todos os canais de voz do servidor', () => {
    const people = voicePeople([
      { participants: [part('u1', { display_name: 'Alice', avatar_url: '/a.png' })] },
      { participants: [part('u2', { display_name: 'Bob' })] }
    ])
    expect(people).toEqual([
      { id: 'u1', name: 'Alice', avatarUrl: '/a.png' },
      { id: 'u2', name: 'Bob', avatarUrl: null }
    ])
  })

  it('o nome cai para o username e depois para "Usuário"', () => {
    const people = voicePeople([
      { participants: [part('u1', { username: 'alice' }), part('u2')] }
    ])
    expect(people.map((p) => p.name)).toEqual(['alice', 'Usuário'])
  })

  it('não repete a mesma pessoa', () => {
    const people = voicePeople([{ participants: [part('u1')] }, { participants: [part('u1')] }])
    expect(people).toHaveLength(1)
  })
})
