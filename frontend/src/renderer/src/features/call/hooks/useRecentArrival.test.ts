import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRecentArrivalsStore } from '../store/recentArrivalsStore'
import { hasRecentArrival } from './useRecentArrival'

const has = (channelId: string | null, userId: string): boolean =>
  hasRecentArrival(channelId, userId)(useRecentArrivalsStore.getState())

describe('hasRecentArrival (seletor do useRecentArrival)', () => {
  afterEach(() => {
    useRecentArrivalsStore.getState().reset()
    vi.useRealTimers()
  })

  it('é verdadeiro só para quem chegou nesse canal e deixa de ser quando o selo vence', () => {
    vi.useFakeTimers()
    useRecentArrivalsStore.getState().join('c1', 'ana', 'eu')
    expect(has('c1', 'ana')).toBe(true)
    expect(has('c1', 'bia')).toBe(false)
    expect(has('c2', 'ana')).toBe(false)
    expect(has(null, 'ana')).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(has('c1', 'ana')).toBe(false)
  })
})
