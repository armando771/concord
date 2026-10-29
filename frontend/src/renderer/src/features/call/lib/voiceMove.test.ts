import { describe, expect, it } from 'vitest'
import { canMoveVoiceUser, voiceChannelOf } from './voiceMove'

describe('canMoveVoiceUser', () => {
  const base = { meId: 'mod', targetId: 'ana', canMoveMembers: true, canActOnTarget: true }

  it('precisa de MOVE_MEMBERS e de estar acima da pessoa', () => {
    expect(canMoveVoiceUser(base)).toBe(true)
    expect(canMoveVoiceUser({ ...base, canMoveMembers: false })).toBe(false)
    expect(canMoveVoiceUser({ ...base, canActOnTarget: false })).toBe(false)
  })

  it('sem login ninguém move', () => {
    expect(canMoveVoiceUser({ ...base, meId: undefined })).toBe(false)
  })

  it('quem move a si mesmo só precisa da permissão', () => {
    expect(
      canMoveVoiceUser({ ...base, targetId: 'mod', canActOnTarget: false, canMoveMembers: true })
    ).toBe(true)
    expect(
      canMoveVoiceUser({ ...base, targetId: 'mod', canActOnTarget: false, canMoveMembers: false })
    ).toBe(false)
  })

  it('suporta canMoveTarget para membros de mesmo cargo', () => {
    expect(
      canMoveVoiceUser({ meId: 'mod', targetId: 'mod2', canMoveMembers: true, canMoveTarget: true })
    ).toBe(true)
    expect(
      canMoveVoiceUser({ meId: 'mod', targetId: 'admin', canMoveMembers: true, canMoveTarget: false })
    ).toBe(false)
  })
  it('moderador não move o dono (a hierarquia nunca deixa)', () => {
    expect(canMoveVoiceUser({ ...base, targetId: 'dono', canActOnTarget: false })).toBe(false)
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
