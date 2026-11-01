import type { CallStateResponse } from '../../call/api/calls'

/** Quem está na call como visitante deste servidor (selo "Visitante"). Puro. */
export function guestIdsOf(state: Pick<CallStateResponse, 'call' | 'participants'>): string[] {
  const serverId = state.call?.server_id
  if (!serverId) return []
  return state.participants.filter((p) => p.guest_of === serverId).map((p) => p.user_id)
}
