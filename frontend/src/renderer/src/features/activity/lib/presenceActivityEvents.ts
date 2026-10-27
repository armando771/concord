import { sanitizeActivity, type PresenceActivity } from './presenceActivity'
import { sanitizeListening, type ListeningActivity } from './listeningActivity'

// presence:activity do WebSocket: o que alguém está jogando e ouvindo agora
// (null = parou). Puro: os stores são injetados (presenceActivityStart liga
// de verdade).

export interface PresenceActivityEventDeps {
  setActivity: (userId: string, activity: PresenceActivity | null) => void
  setListening: (userId: string, listening: ListeningActivity | null) => void
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
  // Servidor antigo não manda "listening": aí a música fica como estava.
  if (p && 'listening' in p) deps.setListening(userId, sanitizeListening(p.listening))
}
