import type { CallResume } from '../../../../../shared/callResume'

/** O pedaço da resposta de "entrar na call" que vira estado local. */
export interface JoinedCallInfo {
  server_id?: string | null
  locked?: boolean
}

/** Mudo/ensurdecido/servidor/trava ao entrar numa call de canal (retomada ou entrada nova). */
export interface ChannelJoinState {
  muted: boolean
  deafened: boolean
  mutedBeforeDeafen: boolean
  serverId: string | null
  locked: boolean
}

/** Entrada nova começa com o microfone aberto; a retomada volta como eu estava. */
export function channelJoinState(call: JoinedCallInfo, resume?: CallResume): ChannelJoinState {
  return {
    muted: !!resume && (resume.muted || resume.deafened),
    deafened: resume?.deafened ?? false,
    mutedBeforeDeafen: resume?.mutedBeforeDeafen ?? false,
    serverId: call.server_id ?? null,
    locked: call.locked ?? false
  }
}
