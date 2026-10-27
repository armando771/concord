import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConnectionStore } from '../../../shared/store/connectionStore'
import { useRecentArrivalsStore } from '../store/recentArrivalsStore'
import { startArrivalBadges } from './arrivalEventsStart'

// O callStore puxa o áudio do navegador (AudioWorklet), que o teste não tem.
vi.mock('../store/callStore', () => ({ useCallStore: { getState: () => ({}) } }))

describe('startArrivalBadges', () => {
  afterEach(() => {
    useRecentArrivalsStore.getState().reset()
    useConnectionStore.getState().wsEvent({ type: 'stop' })
  })

  it('queda do websocket: a próxima lista dos canais vira base, sem selos', () => {
    const stop = startArrivalBadges()
    const arrivals = useRecentArrivalsStore.getState()
    arrivals.ingest('srv', { c1: ['ana'] }, 'eu')
    useConnectionStore.getState().wsEvent({ type: 'connect' })
    useConnectionStore.getState().wsEvent({ type: 'open' })
    useConnectionStore.getState().wsEvent({ type: 'lost', planned: false, attempt: 1 })
    useRecentArrivalsStore.getState().ingest('srv', { c1: ['ana', 'bia'] }, 'eu')
    expect(useRecentArrivalsStore.getState().arrivals).toEqual({})
    stop()
  })

  it('desligado, a queda não mexe no store', () => {
    const stop = startArrivalBadges()
    stop()
    useRecentArrivalsStore.getState().ingest('srv', { c1: ['ana'] }, 'eu')
    useConnectionStore.getState().wsEvent({ type: 'connect' })
    useConnectionStore.getState().wsEvent({ type: 'open' })
    useConnectionStore.getState().wsEvent({ type: 'lost', planned: false, attempt: 1 })
    expect(useRecentArrivalsStore.getState().snapshot).not.toBeNull()
  })
})
