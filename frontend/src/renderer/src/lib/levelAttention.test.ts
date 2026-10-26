import { describe, expect, it } from 'vitest'
import {
  canReplay,
  isAttentive,
  PENDING_MAX_AGE_MS,
  queueLevelUp,
  REPLAY_COOLDOWN_MS,
  resolvePending
} from './levelAttention'

const here = { focused: true, visible: true }

describe('levelAttention: janela', () => {
  it('só conta como presente com foco e visível', () => {
    expect(isAttentive(here)).toBe(true)
    expect(isAttentive({ focused: false, visible: true })).toBe(false)
    expect(isAttentive({ focused: true, visible: false })).toBe(false)
    expect(isAttentive({ focused: false, visible: false })).toBe(false)
  })
})

describe('levelAttention: fila', () => {
  it('a primeira subida entra como veio', () => {
    expect(queueLevelUp(null, { level: 12, previous: 11 }, 100)).toEqual({
      level: 12,
      previous: 11,
      queuedAt: 100
    })
  })

  it('várias viram uma: nível mais alto, partindo do mais baixo', () => {
    const a = queueLevelUp(null, { level: 9, previous: 8 }, 100)
    const b = queueLevelUp(a, { level: 10, previous: 9 }, 200)
    expect(b).toEqual({ level: 10, previous: 8, queuedAt: 200 })
  })

  it('uma subida menor não rebaixa nem rejuvenesce a da fila', () => {
    const a = queueLevelUp(null, { level: 20, previous: 19 }, 100)
    const b = queueLevelUp(a, { level: 15, previous: 14 }, 900)
    expect(b).toEqual({ level: 20, previous: 14, queuedAt: 100 })
  })

  it('o mesmo evento repetido não muda nada', () => {
    const a = queueLevelUp(null, { level: 20, previous: 19 }, 100)
    expect(queueLevelUp(a, { level: 20, previous: 19 }, 100)).toEqual(a)
  })
})

describe('levelAttention: o que fazer com a fila', () => {
  const pending = { level: 30, previous: 29, queuedAt: 1000 }

  it('sem nada na fila não faz nada', () => {
    expect(resolvePending(null, here, 2000)).toBe('wait')
  })

  it('espera enquanto a janela está fora de vista', () => {
    expect(resolvePending(pending, { focused: false, visible: true }, 2000)).toBe('wait')
    expect(resolvePending(pending, { focused: true, visible: false }, 2000)).toBe('wait')
  })

  it('toca quando a pessoa volta', () => {
    expect(resolvePending(pending, here, 2000)).toBe('play')
  })

  it('toca no limite de 10 minutos e descarta depois dele', () => {
    expect(resolvePending(pending, here, 1000 + PENDING_MAX_AGE_MS)).toBe('play')
    expect(resolvePending(pending, here, 1000 + PENDING_MAX_AGE_MS + 1)).toBe('drop')
  })

  it('descarta a velha mesmo com a janela ainda fora de vista', () => {
    const away = { focused: false, visible: false }
    expect(resolvePending(pending, away, 1000 + PENDING_MAX_AGE_MS + 1)).toBe('drop')
  })
})

describe('levelAttention: tocar de novo', () => {
  it('a primeira vez sempre pode', () => {
    expect(canReplay(null, 5000)).toBe(true)
  })

  it('respeita o intervalo', () => {
    expect(canReplay(1000, 1000 + REPLAY_COOLDOWN_MS - 1)).toBe(false)
    expect(canReplay(1000, 1000 + REPLAY_COOLDOWN_MS)).toBe(true)
  })

  it('relógio que voltou para trás não trava o clique', () => {
    expect(canReplay(5000, 1000)).toBe(true)
  })
})
