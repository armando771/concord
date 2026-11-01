import { useRecentArrivalsStore } from '../store/recentArrivalsStore'
import type { ByChannelUser } from '../lib/recentArrivals'

/** O selo dessa pessoa nesse canal está valendo (o store o tira no vencimento). */
export const hasRecentArrival =
  (channelId: string | null | undefined, userId: string) =>
  (s: { arrivals: ByChannelUser }): boolean =>
    channelId ? s.arrivals[channelId]?.[userId] !== undefined : false

/**
 * A pessoa acabou de chegar nesse canal de voz (o selo "Chegou" está valendo).
 * Sem relógio aqui: o store tira o selo sozinho quando ele vence.
 */
export function useRecentArrival(channelId: string | null | undefined, userId: string): boolean {
  return useRecentArrivalsStore(hasRecentArrival(channelId, userId))
}
