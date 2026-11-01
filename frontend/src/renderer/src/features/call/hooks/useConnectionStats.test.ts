import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Harness mínimo para testar o ciclo de coleta sem depender de um DOM simulado.
const harness = vi.hoisted(() => ({
  cleanup: undefined as (() => void) | undefined,
  update: vi.fn(),
  latency: vi.fn(),
  metrics: vi.fn()
}))
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, harness.update],
  useEffect: (effect: () => () => void) => {
    harness.cleanup = effect()
  }
}))
vi.mock('../store/callStore', () => ({ readCallLatency: harness.latency }))

import { useConnectionStats } from './useConnectionStats'

let page: EventTarget & { hidden: boolean }
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  page = Object.assign(new EventTarget(), { hidden: false })
  vi.stubGlobal('document', page)
  vi.stubGlobal('window', { api: { appMetrics: { sample: harness.metrics } } })
  harness.latency.mockResolvedValue(42)
  harness.metrics.mockResolvedValue({ memoryMB: 100, cpuPercent: null })
})
afterEach(() => {
  harness.cleanup?.()
  harness.cleanup = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('coleta sob demanda', () => {
  it('mede a cada 2s, aquece CPU e para ao desmontar', async () => {
    useConnectionStats()
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.metrics).toHaveBeenLastCalledWith(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(harness.metrics).toHaveBeenLastCalledWith(false)
    expect(harness.latency).toHaveBeenCalledTimes(2)
    harness.cleanup?.()
    await vi.advanceTimersByTimeAsync(10000)
    expect(harness.latency).toHaveBeenCalledTimes(2)
  })

  it('pausa oculta e reinicia a referência ao voltar', async () => {
    page.hidden = true
    useConnectionStats()
    await vi.advanceTimersByTimeAsync(10000)
    expect(harness.latency).not.toHaveBeenCalled()
    page.hidden = false
    page.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.metrics).toHaveBeenLastCalledWith(true)
    page.hidden = true
    page.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(10000)
    expect(harness.latency).toHaveBeenCalledTimes(1)
  })

  it('não sobrepõe consultas e descarta resposta antiga após ocultar', async () => {
    let finish: (value: number) => void = () => {}
    harness.latency.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve
        })
    )
    useConnectionStats()
    await vi.advanceTimersByTimeAsync(6000)
    expect(harness.latency).toHaveBeenCalledTimes(1)
    page.hidden = true
    page.dispatchEvent(new Event('visibilitychange'))
    page.hidden = false
    page.dispatchEvent(new Event('visibilitychange'))
    expect(harness.latency).toHaveBeenCalledTimes(1)
    finish(100)
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.latency).toHaveBeenCalledTimes(2)
    expect(harness.update).toHaveBeenCalledTimes(1)
    expect(harness.metrics).toHaveBeenLastCalledWith(true)
  })

  it('ignora resposta depois de desmontar', async () => {
    let finish: (value: number) => void = () => {}
    harness.latency.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve
        })
    )
    useConnectionStats()
    harness.cleanup?.()
    finish(42)
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.update).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('tolera erro de coleta', async () => {
    harness.latency.mockRejectedValueOnce(new Error('disconnected'))
    harness.metrics.mockRejectedValueOnce(new Error('unavailable'))
    useConnectionStats()
    await vi.advanceTimersByTimeAsync(0)
    const update = harness.update.mock.calls[0][0]
    expect(update({ history: [], ceiling: 100 })).toMatchObject({
      history: [{ ms: null }],
      metrics: null,
      pending: false
    })
    harness.cleanup?.()
    expect(vi.getTimerCount()).toBe(0)
  })
})
