import type { MyRank, RankingEntry } from '../api/ranking'

const PODIUM_SIZE = 3

/** Os 3 primeiros (pódio) e o resto da lista. */
export function splitRanking(entries: RankingEntry[]): {
  podium: RankingEntry[]
  rest: RankingEntry[]
} {
  return { podium: entries.slice(0, PODIUM_SIZE), rest: entries.slice(PODIUM_SIZE) }
}

export interface PodiumSlot {
  entry: RankingEntry
  /** Altura relativa do degrau, do 1º (maior) ao 3º. */
  place: 1 | 2 | 3
}

/** Ordem de tela do pódio: 2º, 1º, 3º (o campeão no meio). */
export function podiumSlots(podium: RankingEntry[]): PodiumSlot[] {
  const slot = (i: number): PodiumSlot[] =>
    podium[i] ? [{ entry: podium[i], place: (i + 1) as 1 | 2 | 3 }] : []
  return [...slot(1), ...slot(0), ...slot(2)]
}

export const positionLabel = (position: number): string => `#${position}`

export const formatXp = (xp: number): string => `${xp.toLocaleString('pt-BR')} XP`

export function myPositionText(me: MyRank | null): string {
  return me ? `Sua posição: ${positionLabel(me.position)}` : 'Fique em call para entrar no ranking'
}

/** A pessoa tem posição, mas a linha dela não está na lista mostrada. */
export function isOutsideList(me: MyRank | null, entries: RankingEntry[]): boolean {
  return me !== null && !entries.some((e) => e.position === me.position)
}
