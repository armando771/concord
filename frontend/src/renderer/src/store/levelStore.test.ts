import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/levels', () => ({ fetchLevels: vi.fn(), fetchMyLevel: vi.fn() }))

import { levelUpEffects } from '../lib/levels'
import { useAuthStore } from './authStore'
import { useLevelStore } from './levelStore'

const levelUp = (user_id: string, level: number, previous_level = level - 1): void =>
  useLevelStore.getState().handleWsEvent({
    type: 'level:up',
    payload: { user_id, level, previous_level }
  } as never)

describe('levelStore: celebração', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useLevelStore.getState().reset()
    useAuthStore.setState({ user: { id: 'eu' } as never })
  })
  afterEach(() => vi.useRealTimers())

  it('a celebração dura o tempo do degrau do nível', () => {
    levelUp('ana', 85)
    expect(useLevelStore.getState().celebrations.ana?.level).toBe(85)
    vi.advanceTimersByTime(levelUpEffects(85).durationMs - 1)
    expect(useLevelStore.getState().celebrations.ana).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(useLevelStore.getState().celebrations.ana).toBeUndefined()
    expect(useLevelStore.getState().levels.ana).toBe(85)
  })

  it('prévia (dev) toca em você e devolve o nível de verdade no fim', () => {
    useLevelStore.setState({ levels: { eu: 12 } })
    useLevelStore.getState().previewLevelUp(100)
    expect(useLevelStore.getState().celebrations.eu).toMatchObject({ level: 100, previous: 99 })
    expect(useLevelStore.getState().levels.eu).toBe(100)
    vi.advanceTimersByTime(levelUpEffects(100).durationMs + 100)
    expect(useLevelStore.getState().celebrations.eu).toBeUndefined()
    expect(useLevelStore.getState().levels.eu).toBe(12)
  })

  it('prévia do próximo marco: parte do seu nível de verdade', () => {
    useLevelStore.setState({ levels: { eu: 37 } })
    useLevelStore.getState().previewNextMilestone()
    expect(useLevelStore.getState().celebrations.eu).toMatchObject({ level: 40, previous: 39 })
    vi.advanceTimersByTime(levelUpEffects(40).durationMs + 100)
    expect(useLevelStore.getState().levels.eu).toBe(37)
  })

  it('prévia do próximo marco sem nível carregado começa no 10', () => {
    useLevelStore.getState().previewNextMilestone()
    expect(useLevelStore.getState().celebrations.eu?.level).toBe(10)
  })

  it('prévia ignora nível inválido', () => {
    useLevelStore.getState().previewLevelUp(0)
    useLevelStore.getState().previewLevelUp(Number.NaN)
    expect(useLevelStore.getState().celebrations).toEqual({})
  })
})
