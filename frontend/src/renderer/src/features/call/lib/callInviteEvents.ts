/** O que o tratamento dos eventos escreve (injetado: o teste não sobe o store). */
export interface CallInviteEventDeps {
  /** A call acabou (sem papel) ou o convite foi usado (invitee): o cartão vira "Convite inválido". */
  invalid: (callId: string, role?: 'invitee') => void
}

/** call:invite_ended do WebSocket. */
export function handleCallInviteEvent(
  event: { type: string; payload: unknown },
  deps: CallInviteEventDeps
): void {
  if (event.type !== 'call:invite_ended') return
  const p = event.payload as { call_id?: string; role?: string } | null
  if (p?.call_id) deps.invalid(p.call_id, p.role === 'invitee' ? 'invitee' : undefined)
}
