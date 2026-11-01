import { ApiError } from '../../../shared/api/client'
import { INVITE_COPY } from './callInviteCopy'

/** O que "Abrir" usa (injetado: o teste não sobe a call nem o roteador). */
export interface OpenInviteDeps {
  /** Já está numa chamada de DM (não dá para trocar sem a pessoa desligar). */
  inDmCall: () => boolean
  open: (callId: string) => Promise<unknown>
  /** A call acabou: o cartão vira "Convite inválido". */
  invalid: (callId: string) => void
  /** Entra no canal de voz pelo fluxo normal (sai da call atual, se houver). */
  join: (channelId: string) => Promise<void>
  navigate: (route: string) => void
}

/** Erro com texto pronto para a pessoa (vira aviso na tela). */
export class InviteOpenError extends Error {}

export interface OpenableInvite {
  call_id: string
  channel_id: string
  server_id?: string | null
}

/**
 * Abrir = avisar o servidor (que dá o passe de entrada, valendo até em sala
 * trancada) e então entrar pelo fluxo normal do canal de voz, que valida
 * permissão e "ocupado". Não existe um segundo caminho de entrada.
 */
export async function openInviteAndJoin(
  invite: OpenableInvite,
  deps: OpenInviteDeps
): Promise<void> {
  if (deps.inDmCall()) throw new InviteOpenError(INVITE_COPY.alreadyInDmCall)
  try {
    await deps.open(invite.call_id)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      deps.invalid(invite.call_id)
      return
    }
    throw err
  }
  await deps.join(invite.channel_id)
  if (invite.server_id) deps.navigate(`/servers/${invite.server_id}/channels/${invite.channel_id}`)
}
