import { describe, expect, it } from 'vitest'
import type { CallStateResponse } from '../api/calls'
import { applyLiveEvent, liveUserIds } from './liveBadge'

function entry(screen_sharing?: string[]): CallStateResponse {
  return { call: { id: 'call-1' } as never, participants: [], screen_sharing }
}

describe('applyLiveEvent', () => {
  it('marca quem começou a transmitir na chamada do canal', () => {
    const next = applyLiveEvent(
      { 'canal-1': entry([]) },
      { call_id: 'call-1', user_id: 'ana', active: true }
    )
    expect(next['canal-1'].screen_sharing).toEqual(['ana'])
  })

  it('não duplica quem já estava transmitindo', () => {
    const next = applyLiveEvent(
      { 'canal-1': entry(['ana']) },
      { call_id: 'call-1', user_id: 'ana', active: true }
    )
    expect(next['canal-1'].screen_sharing).toEqual(['ana'])
  })

  it('tira quem parou de transmitir', () => {
    const next = applyLiveEvent(
      { 'canal-1': entry(['ana', 'bia']) },
      { call_id: 'call-1', user_id: 'ana', active: false }
    )
    expect(next['canal-1'].screen_sharing).toEqual(['bia'])
  })

  it('chamada desconhecida não muda nada', () => {
    const map = { 'canal-1': entry(['bia']) }
    expect(applyLiveEvent(map, { call_id: 'outra', user_id: 'ana', active: true })).toEqual(map)
  })

  it('entrada sem screen_sharing ganha a lista', () => {
    const next = applyLiveEvent(
      { 'canal-1': entry() },
      { call_id: 'call-1', user_id: 'ana', active: true }
    )
    expect(next['canal-1'].screen_sharing).toEqual(['ana'])
  })
})

describe('liveUserIds', () => {
  it('junta o servidor com quem transmite na minha chamada', () => {
    expect(liveUserIds(entry(['ana']), ['eu'])).toEqual(new Set(['ana', 'eu']))
  })

  it('sem dados, ninguém ao vivo', () => {
    expect(liveUserIds(undefined, [])).toEqual(new Set())
  })
})
