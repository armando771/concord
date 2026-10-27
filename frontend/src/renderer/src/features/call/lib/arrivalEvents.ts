import { joinedOtherUser, type CallView } from './entranceSound'

/** O que o selo "Chegou" lê e escreve (injetado: os testes não sobem os stores). */
export interface ArrivalEventDeps {
  call: () => CallView & { channelId: string | null }
  meId: () => string | undefined
  join: (channelId: string, userId: string, meId: string | undefined) => void
  leave: (channelId: string, userId: string) => void
}

/**
 * call:joined / call:left da minha call de canal: marca a chegada (o mesmo
 * evento do som de entrada) e a saída (para a volta rápida não contar).
 */
export function handleArrivalEvent(
  event: { type: string; payload: unknown },
  deps: ArrivalEventDeps
): void {
  const call = deps.call()
  if (!call.channelId) return
  if (event.type === 'call:joined') {
    const user = joinedOtherUser(event, call, deps.meId())
    if (user) deps.join(call.channelId, user.id, deps.meId())
    return
  }
  if (event.type !== 'call:left') return
  const p = event.payload as { call_id?: string; user?: { id?: string } } | null
  if (p?.call_id === call.callId && p.user?.id) deps.leave(call.channelId, p.user.id)
}
