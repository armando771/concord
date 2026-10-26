import { describe, expect, it } from 'vitest'
import { hasVoiceParticipants, voiceServerId } from './voiceServer'

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

describe('hasVoiceParticipants', () => {
  it('lista vazia ou canais vazios não contam', () => {
    expect(hasVoiceParticipants([])).toBe(false)
    expect(hasVoiceParticipants([{ participants: [] }])).toBe(false)
  })

  it('basta um canal com gente', () => {
    expect(hasVoiceParticipants([{ participants: [] }, { participants: [{}] }])).toBe(true)
  })
})
