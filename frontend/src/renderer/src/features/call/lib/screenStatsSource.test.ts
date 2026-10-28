import { describe, expect, it, vi } from 'vitest'

vi.mock('livekit-client', () => ({
  Track: { Source: { ScreenShare: 'screen_share' } }
}))

import {
  clearActiveScreenStats,
  readActiveScreenStats,
  readScreenStatsInput,
  setActiveScreenStats,
  type StatsRoomLike
} from './screenStatsSource'

const report = new Map([['o1', { type: 'outbound-rtp' }]]) as unknown as RTCStatsReport

function room(parts: {
  local?: ReturnType<StatsRoomLike['localParticipant']['getTrackPublication']>
  remote?: Record<
    string,
    ReturnType<
      NonNullable<ReturnType<StatsRoomLike['remoteParticipants']['get']>>['getTrackPublication']
    >
  >
}): StatsRoomLike {
  return {
    localParticipant: { getTrackPublication: () => parts.local },
    remoteParticipants: new Map(
      Object.entries(parts.remote ?? {}).map(([id, pub]) => [
        id,
        { getTrackPublication: () => pub }
      ])
    )
  }
}

describe('readScreenStatsInput', () => {
  it('minha live: relatório do envio e o fps pedido na publicação', async () => {
    const input = await readScreenStatsInput(
      room({
        local: {
          videoTrack: {
            getRTCStatsReport: async () => report,
            publishOptions: { screenShareEncoding: { maxFramerate: 60 } }
          }
        }
      }),
      'eu',
      true
    )
    expect(input).toEqual({
      local: true,
      report,
      enabled: true,
      streamState: 'active',
      requestedFps: 60
    })
  })

  it('sem live publicada: null', async () => {
    expect(await readScreenStatsInput(room({}), 'eu', true)).toBeNull()
    expect(await readScreenStatsInput(room({}), 'bia', false)).toBeNull()
  })

  it('live de outra pessoa: recepção, desligada por mim e pausa do servidor', async () => {
    const input = await readScreenStatsInput(
      room({
        remote: {
          bia: {
            isEnabled: false,
            track: { getRTCStatsReport: async () => report, streamState: 'paused' }
          }
        }
      }),
      'bia',
      false
    )
    expect(input).toMatchObject({ local: false, report, enabled: false, streamState: 'paused' })
  })

  it('ainda não assinada: relatório vazio', async () => {
    const input = await readScreenStatsInput(
      room({ remote: { bia: { isEnabled: true } } }),
      'bia',
      false
    )
    expect(input?.report.size).toBe(0)
    expect(input?.streamState).toBe('active')
  })
})

describe('chamada ativa', () => {
  it('lê da chamada registrada; depois de sair, nada', async () => {
    const reader = { readScreenStats: vi.fn(async () => null) }
    setActiveScreenStats(reader)
    await readActiveScreenStats('bia', false)
    expect(reader.readScreenStats).toHaveBeenCalledWith('bia', false)
    const other = { readScreenStats: vi.fn(async () => null) }
    clearActiveScreenStats(other)
    clearActiveScreenStats(reader)
    expect(await readActiveScreenStats('bia', false)).toBeNull()
    expect(reader.readScreenStats).toHaveBeenCalledTimes(1)
  })
})
