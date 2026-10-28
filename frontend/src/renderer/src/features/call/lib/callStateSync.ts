import type { CallStateResponse } from '../api/calls'
import type { CallKind, CallUserInfo, VoiceState } from '../store/callStore'

/** O que o estado local já tinha antes de ler o servidor. */
export interface LocalCallState {
  type: CallKind | null
  locked: boolean
  participants: CallUserInfo[]
  joinRequests: CallUserInfo[]
  voiceStates: Record<string, VoiceState>
  screenWatchers: Record<string, CallUserInfo[]>
}

/** O pedaço do store que a leitura do estado da chamada atualiza. */
export interface SyncedCallState {
  locked: boolean
  participants: CallUserInfo[]
  joinRequests: CallUserInfo[]
  voiceStates: Record<string, VoiceState>
  screenSharers: string[]
  screenWatchers: Record<string, CallUserInfo[]>
}

const addMissing = (current: CallUserInfo[], incoming: CallUserInfo[]): CallUserInfo[] => [
  ...current,
  ...incoming.filter((p) => !current.some((q) => q.id === p.id))
]

const otherParticipants = (state: CallStateResponse, meId: string): CallUserInfo[] =>
  state.participants
    .filter((p) => p.user_id && p.user_id !== meId)
    .map((p) => ({
      id: p.user_id,
      username: p.username ?? '',
      display_name: p.display_name ?? p.username ?? 'Usuário',
      avatar_url: p.avatar_url ?? null,
      name_style: p.name_style
    }))

const serverVoiceStates = (state: CallStateResponse): Record<string, VoiceState> =>
  Object.fromEntries(
    state.participants.map((p) => [
      p.user_id,
      {
        muted: p.muted ?? false,
        deafened: p.deafened ?? false,
        serverMuted: p.server_muted ?? false,
        serverDeafened: p.server_deafened ?? false
      }
    ])
  )

/**
 * Junta o estado da chamada no servidor ao local. `replace` (ao reentrar ou
 * reconectar) faz o servidor valer; senão só soma quem faltava. Na DM a lista
 * de participantes nunca encolhe: o outro lado é a própria chamada.
 */
export function syncCallState(
  state: CallStateResponse,
  meId: string,
  local: LocalCallState,
  replace: boolean
): SyncedCallState {
  const others = otherParticipants(state, meId)
  const joinRequests = (state.join_requests ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url ?? null
  }))
  return {
    locked: state.call?.locked ?? local.locked,
    joinRequests: replace ? joinRequests : addMissing(local.joinRequests, joinRequests),
    screenSharers: state.screen_sharing ?? [],
    screenWatchers: state.screen_watchers ?? local.screenWatchers,
    voiceStates: {
      ...serverVoiceStates(state),
      ...(replace ? {} : local.voiceStates)
    },
    participants:
      replace && local.type === 'channel' ? others : addMissing(local.participants, others)
  }
}
