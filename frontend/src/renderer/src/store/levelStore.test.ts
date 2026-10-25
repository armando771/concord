import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/levels', () => ({ fetchLevels: vi.fn(), fetchMyLevel: vi.fn() }))

import { levelUpEffects, milestoneFor } from '../lib/levels'
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

  it('subida comum durante a cena de um marco: junta, sem cortar o marco', () => {
    levelUp('eu', 30)
    const first = useLevelStore.getState().celebrations.eu!
    vi.advanceTimersByTime(1000)
    levelUp('eu', 31)
    // Mesma celebração (mesma chave: a cena e o jingle seguem), selo no 31.
    expect(useLevelStore.getState().celebrations.eu).toBe(first)
    expect(useLevelStore.getState().levels.eu).toBe(31)
    vi.advanceTimersByTime(levelUpEffects(30).durationMs)
    expect(useLevelStore.getState().celebrations.eu).toBeUndefined()
    expect(useLevelStore.getState().levels.eu).toBe(31)
  })

  it('outro marco durante a cena: entra na fila e toca logo depois', () => {
    levelUp('eu', 30)
    const first = useLevelStore.getState().celebrations.eu!
    vi.advanceTimersByTime(500)
    levelUp('eu', 40, 30)
    expect(useLevelStore.getState().celebrations.eu).toBe(first)
    expect(useLevelStore.getState().levels.eu).toBe(40)
    // Um pouco antes do fim da cena do 30 ainda é ela.
    vi.advanceTimersByTime(milestoneFor(30)!.durationMs - 500 - 1)
    expect(useLevelStore.getState().celebrations.eu?.key).toBe(first.key)
    vi.advanceTimersByTime(1)
    const next = useLevelStore.getState().celebrations.eu!
    expect(next.key).not.toBe(first.key)
    expect(next.level).toBe(40)
    expect(milestoneFor(next.level, next.previous)?.level).toBe(40)
  })

  it('vários marcos na fila viram um só, o mais alto', () => {
    levelUp('eu', 30)
    vi.advanceTimersByTime(200)
    levelUp('eu', 40, 30)
    levelUp('eu', 41, 40)
    levelUp('eu', 50, 41)
    vi.advanceTimersByTime(milestoneFor(30)!.durationMs)
    const next = useLevelStore.getState().celebrations.eu!
    expect(next.level).toBe(50)
    expect(milestoneFor(next.level, next.previous)?.level).toBe(50)
    // Depois dele não sobra nada na fila.
    vi.advanceTimersByTime(levelUpEffects(50, next.previous).durationMs + 10_000)
    expect(useLevelStore.getState().celebrations.eu).toBeUndefined()
  })

  it('sem marco tocando, uma subida nova substitui a anterior (como antes)', () => {
    levelUp('eu', 45)
    const first = useLevelStore.getState().celebrations.eu!
    vi.advanceTimersByTime(500)
    levelUp('eu', 46)
    expect(useLevelStore.getState().celebrations.eu?.key).not.toBe(first.key)
    expect(useLevelStore.getState().celebrations.eu?.level).toBe(46)
  })

  it('depois que a cena do marco acabou, a próxima subida substitui', () => {
    levelUp('eu', 30)
    vi.advanceTimersByTime(milestoneFor(30)!.durationMs + 1)
    levelUp('eu', 31)
    expect(useLevelStore.getState().celebrations.eu?.level).toBe(31)
  })

  it('reset limpa a fila', () => {
    levelUp('eu', 30)
    levelUp('eu', 40, 30)
    useLevelStore.getState().reset()
    vi.advanceTimersByTime(60_000)
    expect(useLevelStore.getState().celebrations).toEqual({})
  })

  it('prévia ignora nível inválido', () => {
    useLevelStore.getState().previewLevelUp(0)
    useLevelStore.getState().previewLevelUp(Number.NaN)
    expect(useLevelStore.getState().celebrations).toEqual({})
  })
})
