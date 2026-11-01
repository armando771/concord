import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Harness mínimo (como o de useConnectionStats): sem DOM simulado.
const harness = vi.hoisted(() => ({
  cleanup: undefined as (() => void) | undefined,
  update: vi.fn(),
  read: vi.fn()
}))
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, harness.update],
  useEffect: (effect: () => () => void) => {
    harness.cleanup = effect()
  }
}))
vi.mock('../lib/screenStatsSource', () => ({ readActiveScreenStats: harness.read }))

import { SCREEN_STATS_MS, useScreenStats } from './useScreenStats'

const report = (bytes: number, timestamp: number): RTCStatsReport =>
  new Map([
    ['o', { id: 'o', type: 'outbound-rtp', kind: 'video', bytesSent: bytes, timestamp }]
  ]) as unknown as RTCStatsReport

const input = (bytes: number, timestamp: number) => ({
  local: true,
  report: report(bytes, timestamp),
  enabled: true,
  streamState: 'active',
  requestedFps: 30
})

const rate = (call: number): string | undefined =>
  harness.update.mock.calls[call][0].rows.find((r: { label: string }) => r.label === 'Taxa')?.value

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => {
  harness.cleanup?.()
  harness.cleanup = undefined
  vi.useRealTimers()
})

describe('useScreenStats', () => {
  it('lê a cada segundo, com taxa entre leituras, e para ao fechar', async () => {
    harness.read.mockResolvedValueOnce(input(0, 0)).mockResolvedValueOnce(input(250_000, 1000))
    useScreenStats('eu', true)
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.read).toHaveBeenCalledWith('eu', true)
    expect(rate(0)).toBe('—')
    await vi.advanceTimersByTimeAsync(SCREEN_STATS_MS)
    expect(rate(1)).toBe('2 Mbps')
    harness.cleanup?.()
    await vi.advanceTimersByTimeAsync(SCREEN_STATS_MS * 5)
    expect(harness.read).toHaveBeenCalledTimes(2)
  })

  it('live que acabou ou erro na leitura: avisa e continua tentando', async () => {
    harness.read.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('x'))
    useScreenStats('bia', false)
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.update).toHaveBeenLastCalledWith({
      rows: [],
      status: 'Transmissão indisponível'
    })
    await vi.advanceTimersByTimeAsync(SCREEN_STATS_MS)
    expect(harness.read).toHaveBeenCalledTimes(2)
    expect(harness.update).toHaveBeenCalledTimes(2)
  })
})
