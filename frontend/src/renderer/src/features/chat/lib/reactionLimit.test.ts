import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/client'
import type { ReactionSummary } from '../api/messages'
import {
  MAX_DISTINCT_REACTIONS,
  canAddReaction,
  distinctReactionCount,
  isReactionLimitError
} from './reactionLimit'

const reactions = (n: number): ReactionSummary[] =>
  Array.from({ length: n }, (_, i) => ({ emoji: `e${i}`, count: 1, user_ids: ['bia'] }))

describe('distinctReactionCount', () => {
  it('conta emojis diferentes (sem reações: zero)', () => {
    expect(distinctReactionCount(undefined)).toBe(0)
    expect(distinctReactionCount(reactions(3))).toBe(3)
  })

  it('emoji repetido na lista conta uma vez só', () => {
    const list = [...reactions(2), { emoji: 'e0', count: 1, user_ids: ['ana'] }]
    expect(distinctReactionCount(list)).toBe(2)
  })
})

describe('canAddReaction', () => {
  it('o limite é o do Discord: 20 diferentes', () => {
    expect(MAX_DISTINCT_REACTIONS).toBe(20)
  })

  it('cabe enquanto houver menos de 20 diferentes', () => {
    expect(canAddReaction(undefined, '👍')).toBe(true)
    expect(canAddReaction(reactions(19), '👍')).toBe(true)
  })

  it('com 20 diferentes, a 21ª não entra', () => {
    expect(canAddReaction(reactions(20), '👍')).toBe(false)
  })

  it('emoji que já está na mensagem continua valendo (pôr ou tirar)', () => {
    expect(canAddReaction(reactions(20), 'e7')).toBe(true)
    expect(canAddReaction(reactions(25), 'e0')).toBe(true)
  })
})

describe('isReactionLimitError', () => {
  it('reconhece o 409 too_many_reactions do servidor', () => {
    expect(isReactionLimitError(new ApiError(409, 'x', 'too_many_reactions'))).toBe(true)
  })

  it('outros erros não são o do limite', () => {
    expect(isReactionLimitError(new ApiError(409, 'x', 'outro'))).toBe(false)
    expect(isReactionLimitError(new ApiError(500, 'x'))).toBe(false)
    expect(isReactionLimitError(new Error('rede'))).toBe(false)
    expect(isReactionLimitError(null)).toBe(false)
  })
})
