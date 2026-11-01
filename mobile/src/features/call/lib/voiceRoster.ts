import type { CallStateResponse } from '../api/calls'
import { stateToPeople } from './callResync'
import type { CallUser } from './callTypes'

/** `GET /calls/active?scope=server` no formato da lista de canais: canal de voz -> quem está nele. */
export function rosterFromCalls(calls: CallStateResponse[]): Record<string, CallUser[]> {
  const roster: Record<string, CallUser[]> = {}
  for (const state of calls) {
    const channelId = state.call?.channel_id
    if (!channelId || state.call?.status === 'ended') continue
    const { people } = stateToPeople(state, null)
    if (people.length > 0) roster[channelId] = people
  }
  return roster
}
