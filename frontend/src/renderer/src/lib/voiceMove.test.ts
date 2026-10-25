import { describe, expect, it } from 'vitest'
import { canMoveVoiceUser, voiceChannelOf } from './voiceMove'

describe('canMoveVoiceUser', () => {
  it('só moderadores e o dono movem', () => {
    expect(
      canMoveVoiceUser({ meId: 'mod', ownerId: 'dono', isModerator: true, targetId: 'ana' })
    ).toBe(true)
    expect(
      canMoveVoiceUser({ meId: 'bia', ownerId: 'dono', isModerator: false, targetId: 'ana' })
    ).toBe(false)
    expect(
      canMoveVoiceUser({ meId: undefined, ownerId: 'dono', isModerator: true, targetId: 'ana' })
    ).toBe(false)
  })

  it('moderador não move o dono; o dono pode', () => {
    expect(
      canMoveVoiceUser({ meId: 'mod', ownerId: 'dono', isModerator: true, targetId: 'dono' })
    ).toBe(false)
    expect(
      canMoveVoiceUser({ meId: 'dono', ownerId: 'dono', isModerator: true, targetId: 'dono' })
    ).toBe(true)
  })
})

describe('voiceChannelOf', () => {
  it('acha o canal em que a pessoa está', () => {
    const calls = {
      geral: { participants: [{ user_id: 'ana' }] },
      jogos: { participants: [{ user_id: 'bia' }, { user_id: 'caio' }] },
      vazio: undefined
    }
    expect(voiceChannelOf(calls, 'caio')).toBe('jogos')
    expect(voiceChannelOf(calls, 'duda')).toBeNull()
  })
})
