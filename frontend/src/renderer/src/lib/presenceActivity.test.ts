import { describe, expect, it } from 'vitest'
import { activityElapsed, activityLine, playingFriends, sanitizeActivity } from './presenceActivity'

const game = { name: 'VALORANT', kind: 'game' as const, started_at: 0 }

describe('sanitizeActivity', () => {
  it('aceita o formato do servidor', () => {
    expect(sanitizeActivity({ name: ' VALORANT ', kind: 'game', started_at: 5 })).toEqual({
      name: 'VALORANT',
      kind: 'game',
      started_at: 5
    })
  })

  it('recusa o que não for uma atividade válida', () => {
    expect(sanitizeActivity(null)).toBeNull()
    expect(sanitizeActivity({ name: '', kind: 'game', started_at: 1 })).toBeNull()
    expect(sanitizeActivity({ name: 'x', kind: 'music', started_at: 1 })).toBeNull()
    expect(sanitizeActivity({ name: 'x', kind: 'game' })).toBeNull()
  })
})

describe('activityElapsed', () => {
  const min = 60_000
  it('escolhe a unidade pelo tempo', () => {
    expect(activityElapsed(0, 30_000)).toBe('agora')
    expect(activityElapsed(0, 5 * min)).toBe('há 5 min')
    expect(activityElapsed(0, 125 * min)).toBe('há 2 h')
    expect(activityElapsed(0, 49 * 60 * min)).toBe('há 2 d')
  })

  it('não fica negativo com relógio adiantado', () => {
    expect(activityElapsed(10 * min, 0)).toBe('agora')
  })
})

describe('activityLine', () => {
  const base = { inVoice: false, note: null, statusLabel: 'Online' }

  it('jogo vence tudo', () => {
    expect(activityLine({ ...base, activity: game, inVoice: true, note: 'oi' })).toEqual({
      kind: 'game',
      text: 'VALORANT'
    })
  })

  it('em voz vem antes da nota', () => {
    expect(activityLine({ ...base, activity: null, inVoice: true, note: 'oi' })).toEqual({
      kind: 'voice',
      text: 'Em voz'
    })
  })

  it('nota, depois status', () => {
    expect(activityLine({ ...base, activity: null, note: ' oi ' })).toEqual({
      kind: 'note',
      text: 'oi'
    })
    expect(activityLine({ ...base, activity: undefined })).toEqual({
      kind: 'status',
      text: 'Online'
    })
  })
})

describe('playingFriends', () => {
  it('só quem joga, o mais recente primeiro', () => {
    const friends = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const byUser = {
      a: { name: 'X', kind: 'game' as const, started_at: 10 },
      c: { name: 'Y', kind: 'game' as const, started_at: 20 }
    }
    expect(playingFriends(friends, byUser).map((p) => p.friend.id)).toEqual(['c', 'a'])
  })
})
