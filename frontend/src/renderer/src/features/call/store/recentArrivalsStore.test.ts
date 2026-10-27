import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRIVAL_BADGE_MS } from '../lib/recentArrivals'
import { useRecentArrivalsStore } from './recentArrivalsStore'

const state = (): ReturnType<typeof useRecentArrivalsStore.getState> =>
  useRecentArrivalsStore.getState()

describe('recentArrivalsStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    state().reset()
  })
  afterEach(() => {
    state().reset()
    vi.useRealTimers()
  })

  it('a chegada some sozinha depois de 5 s', () => {
    state().join('c1', 'ana', 'eu')
    expect(state().arrivals.c1?.ana).toBeDefined()
    vi.advanceTimersByTime(ARRIVAL_BADGE_MS - 1)
    expect(state().arrivals.c1?.ana).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(state().arrivals).toEqual({})
  })

  it('cada selo some no seu tempo', () => {
    state().join('c1', 'ana', 'eu')
    vi.advanceTimersByTime(3000)
    state().join('c1', 'bia', 'eu')
    vi.advanceTimersByTime(2000)
    expect(Object.keys(state().arrivals.c1)).toEqual(['bia'])
    vi.advanceTimersByTime(3000)
    expect(state().arrivals).toEqual({})
  })

  it('a primeira lista é base; a seguinte marca quem chegou', () => {
    state().ingest('srv', { c1: ['ana'] }, 'eu')
    expect(state().arrivals).toEqual({})
    vi.advanceTimersByTime(10_000)
    state().ingest('srv', { c1: ['ana', 'bia'] }, 'eu')
    expect(state().arrivals.c1?.bia).toBeDefined()
  })

  it('resetBaseline faz a próxima lista virar base', () => {
    state().ingest('srv', { c1: ['ana'] }, 'eu')
    state().resetBaseline()
    state().ingest('srv', { c1: ['ana', 'bia'] }, 'eu')
    expect(state().arrivals).toEqual({})
  })

  it('leave tira o selo', () => {
    state().join('c1', 'ana', 'eu')
    state().leave('c1', 'ana')
    expect(state().arrivals).toEqual({})
  })
})
