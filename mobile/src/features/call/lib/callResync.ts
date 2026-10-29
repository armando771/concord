import { ApiError } from '../../../shared/api/client'
import type { CallParticipantInfo, CallStateResponse } from '../api/calls'
import { useCallSessionStore } from '../store/callSessionStore'
import { useParticipantsStore } from '../store/participantsStore'
import type { CallUser, VoiceState } from './callTypes'

const UNKNOWN = 'Usuário'

function toUser(p: CallParticipantInfo): CallUser {
  return {
    id: p.user_id,
    username: p.username ?? '',
    display_name: p.display_name || UNKNOWN,
    avatar_url: p.avatar_url ?? null
  }
}

function toVoice(p: CallParticipantInfo): VoiceState {
  return {
    muted: Boolean(p.muted),
    deafened: Boolean(p.deafened),
    serverMuted: Boolean(p.server_muted),
    serverDeafened: Boolean(p.server_deafened)
  }
}

/** O estado do `GET /calls/:id/state` no formato das stores (sem mim: eu apareço pela barra e pela mídia). */
export function stateToPeople(state: CallStateResponse, meId: string | null): { people: CallUser[]; voice: Record<string, VoiceState> } {
  const others = state.participants.filter((p) => p.user_id !== meId)
  return {
    people: others.map(toUser),
    voice: Object.fromEntries(others.map((p) => [p.user_id, toVoice(p)]))
  }
}

interface ResyncDeps {
  getState: (callId: string) => Promise<CallStateResponse>
  meId: string | null
  /** A chamada acabou enquanto o WebSocket estava fora. */
  onEnded: () => void
}

/**
 * Depois de uma queda do WebSocket, eventos `call:*` se perderam: busca o estado e refaz a lista. 404 ou
 * chamada encerrada fecham a sessão; erro de rede mantém o que já estava (a próxima reconexão tenta de novo).
 */
export async function resyncCall(deps: ResyncDeps): Promise<void> {
  const callId = useCallSessionStore.getState().callId
  if (!callId) return
  try {
    const state = await deps.getState(callId)
    if (!state.call || state.call.status === 'ended') return deps.onEnded()
    const { people, voice } = stateToPeople(state, deps.meId)
    useParticipantsStore.getState().replace(people, voice)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) deps.onEnded()
  }
}
