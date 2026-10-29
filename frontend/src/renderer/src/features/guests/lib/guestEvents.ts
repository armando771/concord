// Eventos de visitante que chegam pelo WebSocket, traduzidos no que o app faz.
// Puro: quem aplica é o store/guestWsEvents.
import type { WsEvent } from '../../../shared/api/ws'
import type { GuestPass } from '../api/guestInvites'
import { GUEST_COPY } from './guestCopy'

export type GuestEventAction =
  /** Entrou pelo link (em qualquer app da conta) ou foi movido de canal. */
  | { kind: 'pass'; pass: GuestPass }
  /** O acesso acabou (prazo, link revogado ou expulso). */
  | { kind: 'ended'; serverId: string; reason: string }
  /** O servidor recusou algo que visitante não faz (trancar a sala...). */
  | { kind: 'refused'; message: string }

type Payload = Record<string, unknown> | null | undefined

const ACTIONS: Record<string, (p: Payload) => GuestEventAction | null> = {
  'guest:pass': (p) => (p?.server_id ? { kind: 'pass', pass: p as unknown as GuestPass } : null),
  'guest:ended': (p) => ({
    kind: 'ended',
    serverId: String(p?.server_id ?? ''),
    reason: String(p?.reason ?? 'removed')
  }),
  'guest:refused': (p) => ({ kind: 'refused', message: String(p?.message ?? GUEST_COPY.refused) })
}

export function guestEventAction(event: WsEvent): GuestEventAction | null {
  return ACTIONS[event.type]?.(event.payload as Payload) ?? null
}

/** O aviso curto quando uma visita some do trilho. */
export function visitEndedMessage(serverName: string | null, reason: string): string {
  if (!serverName) return GUEST_COPY.visitEndedFallback
  return (GUEST_COPY.visitEnded[reason] ?? GUEST_COPY.visitEnded.expired)(serverName)
}
