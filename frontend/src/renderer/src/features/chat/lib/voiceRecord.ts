// Regras do botão de gravar (estilo WhatsApp), sem DOM: segurar grava, soltar
// em cima envia, soltar fora cancela, toque rápido descarta e 5 min envia sozinho.

export const RECORD_MAX_MS = 300_000
export const RECORD_MIN_MS = 500

export type RecordState =
  { phase: 'idle' } | { phase: 'recording'; startedAt: number; inside: boolean }

export type RecordEvent =
  | { type: 'press'; at: number }
  | { type: 'leave' }
  | { type: 'enter' }
  | { type: 'release'; at: number }
  | { type: 'tick'; at: number }

export type RecordAction = 'start' | 'send' | 'cancel' | 'discard' | null

const IDLE: RecordState = { phase: 'idle' }

export function recordStep(
  state: RecordState,
  event: RecordEvent
): { state: RecordState; action: RecordAction } {
  if (state.phase === 'idle') {
    if (event.type === 'press') {
      return { state: { phase: 'recording', startedAt: event.at, inside: true }, action: 'start' }
    }
    return { state, action: null }
  }

  switch (event.type) {
    case 'press':
      return { state, action: null }
    case 'leave':
      return { state: { ...state, inside: false }, action: null }
    case 'enter':
      return { state: { ...state, inside: true }, action: null }
    case 'release':
      if (!state.inside) return { state: IDLE, action: 'cancel' }
      if (event.at - state.startedAt < RECORD_MIN_MS) return { state: IDLE, action: 'discard' }
      return { state: IDLE, action: 'send' }
    case 'tick':
      if (event.at - state.startedAt < RECORD_MAX_MS) return { state, action: null }
      return { state: IDLE, action: state.inside ? 'send' : 'cancel' }
  }
}

export function recordElapsed(state: RecordState, now: number): number {
  return state.phase === 'recording' ? Math.max(0, now - state.startedAt) : 0
}
