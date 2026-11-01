// Presença na call (#374): o app diz ao servidor em que call está a cada
// conexão do WebSocket. "Não estou em nenhuma" (null) só depois que a retomada
// da call (app reaberto pela atualização) decidiu; o servidor tira da call
// quem diz não estar e não está na sala de mídia.

export interface PresenceState {
  wsOpen: boolean
  /** A retomada depois de reabrir o app já decidiu (ou não havia). */
  resumeSettled: boolean
  status: 'idle' | 'ringing' | 'outgoing' | 'active'
  callId: string | null
}

interface Dependencies {
  read: () => PresenceState
  send: (callId: string | null) => void
}

/** A call a anunciar; undefined = ainda não dá para saber (tocando, chamando, retomando). */
function presenceOf(state: PresenceState): string | null | undefined {
  if (!state.wsOpen || !state.resumeSettled) return undefined
  if (state.status === 'idle') return null
  if (state.status === 'active' && state.callId) return state.callId
  return undefined
}

/** Manda a presença uma vez por conexão e de novo quando ela muda. */
export function createPresenceReporter(deps: Dependencies): {
  opened: () => void
  update: () => void
} {
  let connection = 0
  let sent: { connection: number; callId: string | null } | null = null
  const update = (): void => {
    const callId = presenceOf(deps.read())
    if (callId === undefined) return
    if (sent && sent.connection === connection && sent.callId === callId) return
    sent = { connection, callId }
    deps.send(callId)
  }
  return {
    opened: () => {
      connection++
      update()
    },
    update
  }
}
