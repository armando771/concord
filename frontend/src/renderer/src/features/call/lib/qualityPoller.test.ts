import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  QUALITY_STATS_INTERVAL_MS,
  type CallQuality,
  type QualityDetails
} from './connectionQuality'
import { createQualityPoller } from './qualityPoller'

interface Conn {
  getQualityDetails: ReturnType<typeof vi.fn>
}

const DETAILS: Record<string, QualityDetails> = { ana: { lossPercent: 12, latencyMs: null } }

function setup(initial: Record<string, CallQuality>): {
  state: {
    quality: Record<string, CallQuality>
    details: Record<string, QualityDetails>
    current: boolean
  }
  connection: Conn
  poller: ReturnType<typeof createQualityPoller<Conn>>
} {
  const state = { quality: initial, details: {} as Record<string, QualityDetails>, current: true }
  const connection: Conn = { getQualityDetails: vi.fn(async () => DETAILS) }
  const poller = createQualityPoller<Conn>({
    isCurrent: () => state.current,
    quality: () => state.quality,
    details: () => state.details,
    selfId: () => 'eu',
    setDetails: (d) => {
      state.details = d
    }
  })
  return { state, connection, poller }
}

describe('qualityPoller', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('lê as estatísticas só de quem está com conexão ruim', async () => {
    const { state, connection, poller } = setup({ ana: 'poor', bia: 'good' })
    poller.start(connection)

    await vi.advanceTimersByTimeAsync(QUALITY_STATS_INTERVAL_MS)

    expect(connection.getQualityDetails).toHaveBeenCalledWith(['ana'], 'eu')
    expect(state.details).toEqual(DETAILS)
    poller.stop()
  })

  it('limpa os detalhes quando ninguém está mais ruim', async () => {
    const { state, connection, poller } = setup({ ana: 'good' })
    state.details = DETAILS
    poller.start(connection)

    await vi.advanceTimersByTimeAsync(QUALITY_STATS_INTERVAL_MS)

    expect(connection.getQualityDetails).not.toHaveBeenCalled()
    expect(state.details).toEqual({})
    poller.stop()
  })

  it('para sozinho quando a conexão deixa de ser a da chamada', async () => {
    const { state, connection, poller } = setup({ ana: 'lost' })
    poller.start(connection)
    state.current = false

    await vi.advanceTimersByTimeAsync(QUALITY_STATS_INTERVAL_MS * 3)

    expect(connection.getQualityDetails).not.toHaveBeenCalled()
  })
})
