import type { CallPhase } from './callTypes'

// Presença na call (ADR 0018): o app diz ao servidor em que call está a cada conexão do WebSocket. O servidor
// tira da call quem diz não estar e não está na sala de mídia. Porte do `callPresence.ts` do desktop; o app
// mobile não tem "retomada depois de atualizar", então não há `resumeSettled`.

export interface PresenceState {
  wsOpen: boolean
  phase: CallPhase
  callId: string | null
}

interface Dependencies {
  read: () => PresenceState
  send: (callId: string | null) => void
}

const IN_MEDIA: CallPhase[] = ['connecting', 'active', 'reconnecting']

/** A call a anunciar; undefined = ainda não dá para saber (tocando ou chamando). */
function presenceOf(state: PresenceState): string | null | undefined {
  if (!state.wsOpen) return undefined
  if (state.phase === 'idle') return null
  if (IN_MEDIA.includes(state.phase) && state.callId) return state.callId
  return undefined
}

/** Manda a presença uma vez por conexão e de novo quando ela muda. */
export function createPresenceReporter(deps: Dependencies): { opened: () => void; update: () => void } {
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
