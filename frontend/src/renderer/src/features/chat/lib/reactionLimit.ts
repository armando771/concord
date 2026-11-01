import { ApiError } from '../../../shared/api/client'
import type { ReactionSummary } from '../api/messages'

/**
 * Quantas reações diferentes (emojis distintos) uma mensagem aceita: o limite
 * do Discord, o mesmo do servidor (message.MaxDistinctReactions).
 */
export const MAX_DISTINCT_REACTIONS = 20

/** Quantos emojis diferentes a mensagem já tem. */
export function distinctReactionCount(reactions: ReactionSummary[] | undefined): number {
  return new Set((reactions ?? []).map((r) => r.emoji)).size
}

/**
 * Pode reagir com `emoji`? Emoji que já está na mensagem sempre pode (pôr ou
 * tirar a minha); um novo só se ainda não chegou a 20 diferentes.
 */
export function canAddReaction(reactions: ReactionSummary[] | undefined, emoji: string): boolean {
  if (reactions?.some((r) => r.emoji === emoji)) return true
  return distinctReactionCount(reactions) < MAX_DISTINCT_REACTIONS
}

/** O servidor recusou porque a mensagem já tem reações diferentes demais (409). */
export function isReactionLimitError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.code === 'too_many_reactions'
}
