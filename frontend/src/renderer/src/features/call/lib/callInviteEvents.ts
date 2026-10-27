/** O que o tratamento dos eventos escreve (injetado: o teste não sobe o store). */
export interface CallInviteEventDeps {
  /** A call do convite acabou: o cartão na DM vira "Convite inválido". */
  invalid: (callId: string) => void
}

/** call:invite_ended do WebSocket. */
export function handleCallInviteEvent(
  event: { type: string; payload: unknown },
  deps: CallInviteEventDeps
): void {
  if (event.type !== 'call:invite_ended') return
  const callId = (event.payload as { call_id?: string } | null)?.call_id
  if (callId) deps.invalid(callId)
}
