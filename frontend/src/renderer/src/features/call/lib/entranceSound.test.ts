import { describe, expect, it } from 'vitest'
import { chooseJoinSound, entranceSoundSrc, joinedOtherUser, type CallView } from './entranceSound'

const SOUND = '/api/entrance-sounds/0b6e7a52-3c1f-4c47-9d0e-2f6a8b1c4d5e'
const inCall: CallView = { callId: 'call-1', type: 'channel', status: 'active' }
const joined = (
  user: Record<string, unknown>,
  callId = 'call-1'
): { type: string; payload: unknown } => ({
  type: 'call:joined',
  payload: { call_id: callId, user }
})

describe('entranceSoundSrc', () => {
  it('desktop: a URL salva ganha a origem do servidor', () => {
    expect(entranceSoundSrc(SOUND, 'https://salinha.app/api')).toBe(`https://salinha.app${SOUND}`)
  })

  it('navegador: mesma origem, a URL fica como está', () => {
    expect(entranceSoundSrc(SOUND, '/api')).toBe(SOUND)
  })

  it('só aceita o caminho do som de entrada (nada de URL de fora)', () => {
    for (const url of [
      null,
      undefined,
      '',
      'https://evil.example/som.mp3',
      '/api/profile-media/0b6e7a52-3c1f-4c47-9d0e-2f6a8b1c4d5e',
      '/api/entrance-sounds/../users/me',
      `${SOUND}?x=1`
    ]) {
      expect(entranceSoundSrc(url, '/api')).toBeNull()
    }
  })
})

describe('joinedOtherUser', () => {
  it('alguém entrando na minha call de canal ativa', () => {
    expect(joinedOtherUser(joined({ id: 'ana' }), inCall, 'eu')).toEqual({ id: 'ana' })
  })

  it('ignora outros eventos, outra call, DM, call não ativa e eu mesmo', () => {
    expect(joinedOtherUser({ type: 'call:left', payload: {} }, inCall, 'eu')).toBeNull()
    expect(joinedOtherUser(joined({ id: 'ana' }, 'call-2'), inCall, 'eu')).toBeNull()
    expect(joinedOtherUser(joined({ id: 'ana' }), { ...inCall, type: 'dm' }, 'eu')).toBeNull()
    expect(
      joinedOtherUser(joined({ id: 'ana' }), { ...inCall, status: 'outgoing' }, 'eu')
    ).toBeNull()
    expect(joinedOtherUser(joined({ id: 'eu' }), inCall, 'eu')).toBeNull()
    expect(joinedOtherUser(joined({ id: 'ana' }), inCall, undefined)).toBeNull()
  })

  it('payload quebrado não derruba', () => {
    expect(joinedOtherUser({ type: 'call:joined', payload: null }, inCall, 'eu')).toBeNull()
    expect(
      joinedOtherUser({ type: 'call:joined', payload: { call_id: 'call-1' } }, inCall, 'eu')
    ).toBeNull()
  })
})

describe('chooseJoinSound', () => {
  const opts = { deafened: false, locallyMuted: false, volume: 0.8, apiBase: '/api' }

  it('com som de entrada: toca o da pessoa no volume da mesa de áudio', () => {
    expect(chooseJoinSound({ id: 'ana', entrance_sound_url: SOUND }, opts)).toEqual({
      kind: 'custom',
      src: SOUND,
      volume: 0.8
    })
  })

  it('sem som de entrada (ou com URL inválida): som padrão', () => {
    expect(chooseJoinSound({ id: 'ana' }, opts)).toEqual({ kind: 'default' })
    expect(chooseJoinSound({ id: 'ana', entrance_sound_url: 'https://x.y/a.mp3' }, opts)).toEqual({
      kind: 'default'
    })
  })

  it('ensurdecido, pessoa silenciada por mim ou volume da mesa zerado: som padrão', () => {
    const user = { id: 'ana', entrance_sound_url: SOUND }
    expect(chooseJoinSound(user, { ...opts, deafened: true })).toEqual({ kind: 'default' })
    expect(chooseJoinSound(user, { ...opts, locallyMuted: true })).toEqual({ kind: 'default' })
    expect(chooseJoinSound(user, { ...opts, volume: 0 })).toEqual({ kind: 'default' })
  })
})
