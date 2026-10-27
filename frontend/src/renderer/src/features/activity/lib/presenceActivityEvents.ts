import { sanitizeActivity, type PresenceActivity } from './presenceActivity'

// presence:activity do WebSocket: o que alguém está jogando agora (null =
// parou). Puro: o store é injetado (presenceActivityStart liga de verdade).

export interface PresenceActivityEventDeps {
  setActivity: (userId: string, activity: PresenceActivity | null) => void
}

export function handlePresenceActivityEvent(
  event: { type: string; payload: unknown },
  deps: PresenceActivityEventDeps
): void {
  if (event.type !== 'presence:activity') return
  const p = event.payload as Record<string, unknown> | null
  const userId = p?.user_id
  if (typeof userId !== 'string' || !userId) return
  deps.setActivity(userId, sanitizeActivity(p?.activity))
}
