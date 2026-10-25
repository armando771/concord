import { request } from './client'

// Status efetivo de cada id ("offline" se desconectado ou invisível). Backend
// antigo mandava true/false.
export type PresenceMap = Record<string, string | boolean>

export function fetchPresence(userIds: string[]): Promise<PresenceMap> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return Promise.resolve({})
  return request<PresenceMap>(`/presence?ids=${encodeURIComponent(unique.join(','))}`)
}

// Jogo em andamento de cada id que posso ver (quem não aparece não tem).
export function fetchActivities(userIds: string[]): Promise<Record<string, unknown>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return Promise.resolve({})
  return request<Record<string, unknown>>(
    `/presence/activities?ids=${encodeURIComponent(unique.join(','))}`
  )
}
