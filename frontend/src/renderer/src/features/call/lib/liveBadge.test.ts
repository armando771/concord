import { describe, expect, it } from 'vitest'
import type { CallStateResponse } from '../api/calls'
import { applyLiveEvent, LIVE_GRACE_MS, liveUserIds, reapplyRecentLive } from './liveBadge'

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

describe('reapplyRecentLive', () => {
  const live = { call_id: 'call-1', user_id: 'ana', active: true }

  it('polling que saiu antes do call:live não apaga o selo', () => {
    const next = reapplyRecentLive({ 'canal-1': entry([]) }, [{ payload: live, at: 1000 }], 1500)
    expect(next['canal-1'].screen_sharing).toEqual(['ana'])
  })

  it('call:live antigo não vale mais: o polling manda', () => {
    const next = reapplyRecentLive(
      { 'canal-1': entry([]) },
      [{ payload: live, at: 1000 }],
      1000 + LIVE_GRACE_MS
    )
    expect(next['canal-1'].screen_sharing).toEqual([])
  })

  it('reaplica na ordem em que chegaram', () => {
    const next = reapplyRecentLive(
      { 'canal-1': entry([]) },
      [
        { payload: live, at: 1000 },
        { payload: { ...live, active: false }, at: 1100 }
      ],
      1200
    )
    expect(next['canal-1'].screen_sharing).toEqual([])
  })
})
