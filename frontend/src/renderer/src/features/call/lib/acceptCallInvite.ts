import type { ReceivedInvite } from '../api/callInvites'

/** O que aceitar o convite usa (injetado: o teste não sobe a call nem o roteador). */
export interface AcceptInviteDeps {
  /** Já está numa chamada de DM (não dá para trocar sem o usuário desligar). */
  inDmCall: () => boolean
  accept: (callId: string) => Promise<unknown>
  /** Tira o cartão do convite. */
  resolved: (callId: string) => void
  /** Entra no canal de voz pelo fluxo normal (sai da call atual, se houver). */
  join: (channelId: string) => Promise<void>
  navigate: (route: string) => void
}

export class InviteAcceptError extends Error {}

/**
 * Aceitar = avisar o servidor (que dá o passe de entrada, valendo até em sala
 * trancada) e então entrar pelo fluxo normal do canal de voz, que valida
 * permissão e "ocupado". Não existe um segundo caminho de entrada.
 */
export async function acceptInviteAndJoin(
  invite: ReceivedInvite,
  deps: AcceptInviteDeps
): Promise<void> {
  if (deps.inDmCall()) throw new InviteAcceptError('Você já está em uma chamada.')
  await deps.accept(invite.call_id)
  deps.resolved(invite.call_id)
  if (!invite.channel_id) return
  await deps.join(invite.channel_id)
  if (invite.server_id) deps.navigate(`/servers/${invite.server_id}/channels/${invite.channel_id}`)
}
