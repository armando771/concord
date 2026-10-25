// Painel "Voz conectada" (embaixo da sidebar, acima do usuário): textos e para
// onde o clique no nome do canal leva. Puro, sem React.
import type { CallKind, CallStatus } from '../../store/callStore'
import { callRoute } from './callUtils'

/** "canal / servidor" na chamada de canal; o nome da pessoa na DM. */
export function voicePanelLabel(call: {
  type: CallKind | null
  channelName: string | null | undefined
  serverName: string | null | undefined
  peerName: string | null | undefined
}): string {
  if (call.type === 'channel') {
    const channel = call.channelName?.trim() || 'Canal de voz'
    const server = call.serverName?.trim()
    return server ? `${channel} / ${server}` : channel
  }
  return call.peerName?.trim() || 'Chamada'
}

/**
 * Para onde o clique no nome leva, de qualquer tela: o canal de voz no
 * servidor da chamada (não o que está aberto) ou a DM com a pessoa.
 */
export function voicePanelRoute(call: {
  type: CallKind | null
  serverId: string | null
  channelId: string | null
  participants: { id: string }[]
}): string | null {
  return callRoute({
    type: call.type,
    serverId: call.serverId,
    channelId: call.channelId,
    peerId: call.participants[0]?.id ?? null
  })
}

/** Só na chamada (ou chamando alguém); a chamada recebida é do modal. */
export function showVoicePanel(status: CallStatus): boolean {
  return status === 'active' || status === 'outgoing'
}

export function voicePanelHeading(status: CallStatus): string {
  return status === 'outgoing' ? 'Chamando...' : 'Voz conectada'
}

/** Linha embaixo do nome na barra do usuário. */
export function userBarSubtitle(user: {
  inCall: boolean
  note: string | null | undefined
  statusLabel: string
}): string {
  if (user.inCall) return 'Em call'
  return user.note?.trim() || user.statusLabel
}
