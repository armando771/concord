import { describe, expect, it } from 'vitest'
import { ttsNames, type TTSNameSources } from './ttsNames'

const sources: TTSNameSources = {
  participants: [{ id: 'u1', username: 'ana', display_name: 'Ana' }],
  nicknames: { s1: { u1: 'Aninha', u2: 'Bibi' } },
  currentServerId: 's1',
  currentMembers: [{ user_id: 'u2', username: 'bia', display_name: 'Beatriz' }]
}

describe('ttsNames', () => {
  it('canal: apelidos do servidor da call, de quem está na call e dos membros', () => {
    const names = ttsNames('u2', 's1', sources)
    expect(names.labels).toEqual({ ana: 'Aninha', bia: 'Bibi' })
    expect(names.authorNickname).toBe('Bibi')
  })
  it('membros de outro servidor aberto não entram', () => {
    const names = ttsNames('u1', 's1', { ...sources, currentServerId: 's9' })
    expect(names.labels).toEqual({ ana: 'Aninha' })
  })
  it('DM: sem apelido, nome de exibição de quem está na call', () => {
    const names = ttsNames('u1', null, sources)
    expect(names.labels).toEqual({ ana: 'Ana' })
    expect(names.authorNickname).toBeUndefined()
  })
})
