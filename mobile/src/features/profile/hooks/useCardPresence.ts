import { useAuthStore } from '../../auth/store/authStore'
import { usePresenceStore } from '../../friends/store/presenceStore'
import type { PresenceStatus } from '../../friends/lib/presenceStatus'

/**
 * Status para a bolinha do cartão. Quem é você e não tem status conhecido está online (o app está
 * aberto); de outra pessoa sem status conhecido não mostramos bolinha.
 */
export function useCardPresence(userId: string): PresenceStatus | undefined {
  const known = usePresenceStore((s) => s.statuses[userId])
  const isMe = useAuthStore((s) => s.user?.id === userId)
  return known ?? (isMe ? 'online' : undefined)
}
