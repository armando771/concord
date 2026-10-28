import { request } from '../../../shared/api/client'

/** mitico: acima de lendário, só nos exclusivos (Fundador e Top 10 do Nível 100). */
export type BadgeRarity = 'comum' | 'raro' | 'epico' | 'lendario' | 'mitico'

export type BadgeUnit =
  | 'seconds'
  | 'months'
  | 'messages'
  | 'reactions'
  | 'level'
  | 'people'
  | 'servers'
  | 'founder'
  | 'dev'
  | 'proposals'
  | 'vote'
  | 'songs'
  | 'sounds'
  | 'stickers'
  | 'days'
  | 'votes'
  | 'birthday'
  | 'firsts'
  | 'friends'
  | 'bugs'
  | 'rank'

export interface BadgeTier {
  tier: number
  name: string
  threshold: number
  rarity: BadgeRarity
  unlocked_at?: string
}

/**
 * Uma categoria de badge já conquistada (backend: internal/badge). A API só
 * devolve categorias com o tier 1 e só os tiers conquistados: nunca o próximo
 * limite nem o progresso. No perfil de outra pessoa não vem o value, e
 * unlocked_at é só o dia ("2026-07-29").
 */
export interface Badge {
  category: string
  name: string
  description: string
  unit: BadgeUnit
  /** Só no próprio perfil (no Top 10, a posição vem para todos). */
  value?: number
  /** Tier atual (1 ou mais). */
  tier: number
  tier_name?: string
  rarity?: BadgeRarity
  unlocked_at?: string
  /** Só os tiers conquistados, do primeiro ao atual. */
  tiers: BadgeTier[]
}

export interface BadgesResponse {
  user_id: string
  /** true: a própria pessoa (visão completa). */
  self: boolean
  badges: Badge[]
}

/** Evento badge:unlock (só para a própria pessoa). */
export interface BadgeUnlockEvent {
  user_id: string
  unlocks: {
    category: string
    name: string
    tier: number
    tier_name: string
    rarity: BadgeRarity
  }[]
}

export function fetchBadges(userId: string): Promise<BadgesResponse> {
  return request<BadgesResponse>(`/users/${encodeURIComponent(userId)}/badges`)
}
