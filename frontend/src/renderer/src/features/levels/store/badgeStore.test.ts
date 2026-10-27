import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/badges', () => ({ fetchBadges: vi.fn() }))

import { fetchBadges } from '../api/badges'
import { UNLOCK_TOAST_MS, useBadgeStore } from './badgeStore'

const fetchMock = vi.mocked(fetchBadges)

describe('badgeStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ user_id: 'eu', self: true, badges: [] })
    useBadgeStore.getState().reset()
  })
  afterEach(() => vi.useRealTimers())

  it('junta pedidos iguais e usa o cache por um minuto', async () => {
    await Promise.all([
      useBadgeStore.getState().ensureBadges('ana'),
      useBadgeStore.getState().ensureBadges('ana')
    ])
    await useBadgeStore.getState().ensureBadges('ana')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(61_000)
    await useBadgeStore.getState().ensureBadges('ana')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('badge:unlock mostra o aviso, some sozinho e recarrega os seus badges', async () => {
    await useBadgeStore.getState().ensureBadges('eu')
    useBadgeStore.getState().handleWsEvent({
      type: 'badge:unlock',
      payload: {
        user_id: 'eu',
        unlocks: [
          {
            category: 'voz',
            name: 'Tempo em call',
            tier: 2,
            tier_name: 'Tagarela',
            rarity: 'comum'
          }
        ]
      }
    })
    expect(useBadgeStore.getState().toast?.unlocks[0].tier_name).toBe('Tagarela')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(UNLOCK_TOAST_MS)
    expect(useBadgeStore.getState().toast).toBeNull()
  })

  it('ignora eventos sem tiers', () => {
    useBadgeStore
      .getState()
      .handleWsEvent({ type: 'badge:unlock', payload: { user_id: 'eu', unlocks: [] } })
    expect(useBadgeStore.getState().toast).toBeNull()
  })

  describe('Fez o L (tem celebração própria)', () => {
    const l = { category: 'l', name: 'Fez o L', tier: 1, tier_name: 'Fez o L', rarity: 'lendario' }
    const voz = {
      category: 'voz',
      name: 'Tempo em call',
      tier: 2,
      tier_name: 'Tagarela',
      rarity: 'comum'
    }

    it('não mostra o aviso genérico, mas recarrega os badges', () => {
      useBadgeStore
        .getState()
        .handleWsEvent({ type: 'badge:unlock', payload: { user_id: 'eu', unlocks: [l] } })
      expect(useBadgeStore.getState().toast).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('junto com outro badge, o aviso mostra só o outro', () => {
      useBadgeStore
        .getState()
        .handleWsEvent({ type: 'badge:unlock', payload: { user_id: 'eu', unlocks: [l, voz] } })
      expect(useBadgeStore.getState().toast?.unlocks).toEqual([voz])
    })
  })
})
