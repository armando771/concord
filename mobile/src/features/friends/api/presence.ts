import { request } from '../../../shared/api/client'

// Status efetivo de cada id ("offline" se desconectado ou invisível). Backend antigo mandava true/false.
export type PresenceMap = Record<string, string | boolean>

export function fetchPresence(userIds: string[]): Promise<PresenceMap> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return Promise.resolve({})
  return request<PresenceMap>(`/presence?ids=${encodeURIComponent(unique.join(','))}`)
}
