// Conexão da chamada com o servidor de voz (LiveKit), do ponto de vista de
// quem está entrando: em que fase está, se está demorando (e por quê) e o erro
// em português quando falha. Puro, sem o SDK: os códigos abaixo espelham os
// enums do livekit-client (o teste confere que batem).

/** Demorando mais que isso para conectar (ou reconectar): explica e oferece sair. */
export const CALL_SLOW_MS = 10_000
/** Falhou e ninguém decidiu nada: sai sozinho para não ficar "fantasma" na sala. */
export const CALL_FAILED_AUTO_LEAVE_MS = 60_000

/**
 * Etapa da entrada: 'token' = pedindo acesso ao nosso servidor; 'signal' =
 * abrindo o canal de controle com o servidor de voz; 'media' = o controle
 * abriu, falta o áudio (WebRTC/UDP) passar.
 */
export type CallJoinStep = 'token' | 'signal' | 'media'

export type CallConnectionPhase = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'

export interface CallConnection {
  phase: CallConnectionPhase
  /** Só em 'connecting'. */
  step: CallJoinStep | null
  /** Quando a fase atual começou (para saber se está demorando). */
  since: number
  /** Motivo em português (só em 'failed'). */
  error: string | null
}

export const IDLE_CALL_CONNECTION: CallConnection = {
  phase: 'idle',
  step: null,
  since: 0,
  error: null
}

export type CallConnectionEvent =
  | { type: 'start' }
  | { type: 'step'; step: CallJoinStep }
  | { type: 'connected' }
  | { type: 'reconnecting' }
  | { type: 'reconnected' }
  | { type: 'failed'; error: string }
  | { type: 'reset' }

export function callConnectionReducer(
  state: CallConnection,
  event: CallConnectionEvent,
  now: number
): CallConnection {
  switch (event.type) {
    case 'start':
      return { phase: 'connecting', step: 'token', since: now, error: null }
    case 'step':
      // Só avança dentro de uma entrada em andamento (eventos atrasados não voltam fase).
      if (state.phase !== 'connecting') return state
      return { ...state, step: event.step }
    case 'connected':
      if (state.phase === 'idle') return state
      return { phase: 'connected', step: null, since: now, error: null }
    case 'reconnecting':
      if (state.phase !== 'connected') return state
      return { phase: 'reconnecting', step: null, since: now, error: null }
    case 'reconnected':
      if (state.phase !== 'reconnecting') return state
      return { phase: 'connected', step: null, since: now, error: null }
    case 'failed':
      if (state.phase === 'idle') return state
      return { phase: 'failed', step: null, since: now, error: event.error }
    case 'reset':
      return IDLE_CALL_CONNECTION
  }
}

/** Espelho de ConnectionErrorReason (livekit-client). */
export const LK_CONNECTION_ERROR = {
  NotAllowed: 0,
  ServerUnreachable: 1,
  InternalError: 2,
  Cancelled: 3,
  LeaveRequest: 4,
  Timeout: 5,
  WebSocket: 6,
  ServiceNotFound: 7
} as const

/** Espelho de DisconnectReason (livekit-client / protocolo). */
export const LK_DISCONNECT = {
  UNKNOWN_REASON: 0,
  CLIENT_INITIATED: 1,
  DUPLICATE_IDENTITY: 2,
  SERVER_SHUTDOWN: 3,
  PARTICIPANT_REMOVED: 4,
  ROOM_DELETED: 5,
  STATE_MISMATCH: 6,
  JOIN_FAILURE: 7,
  SIGNAL_CLOSE: 9,
  ROOM_CLOSED: 10,
  CONNECTION_TIMEOUT: 14,
  MEDIA_FAILURE: 15
} as const

export const UDP_BLOCKED_MESSAGE =
  'Não foi possível conectar ao servidor de voz (UDP bloqueado?). VPN, rede de empresa ou de escola às vezes bloqueiam chamadas.'
const OFFLINE_MESSAGE = 'Você está sem internet.'
const UNREACHABLE_MESSAGE =
  'Não foi possível alcançar o servidor de voz. Confira sua internet e tente de novo.'

/** Erro de entrada do LiveKit (ConnectionError), reconhecido sem importar o SDK. */
interface LivekitConnectionError {
  name: string
  reason: number
  message: string
  context?: unknown
}

function isLivekitConnectionError(err: unknown): err is LivekitConnectionError {
  if (!err || typeof err !== 'object') return false
  const e = err as Partial<LivekitConnectionError>
  return e.name === 'ConnectionError' && typeof e.reason === 'number'
}

/**
 * Por que a chamada caiu (evento Disconnected do LiveKit que ele não
 * conseguiu recuperar). Cliente e moderador não chegam aqui.
 */
export function describeDisconnect(reason: number | undefined, online: boolean): string {
  switch (reason) {
    case LK_DISCONNECT.DUPLICATE_IDENTITY:
      return 'Você entrou nesta chamada em outra janela ou aparelho.'
    case LK_DISCONNECT.SERVER_SHUTDOWN:
      return 'O servidor de voz reiniciou. Tente entrar de novo.'
    case LK_DISCONNECT.ROOM_DELETED:
    case LK_DISCONNECT.ROOM_CLOSED:
      return 'A sala de voz foi encerrada.'
    case LK_DISCONNECT.JOIN_FAILURE:
    case LK_DISCONNECT.MEDIA_FAILURE:
      return UDP_BLOCKED_MESSAGE
  }
  if (!online) return 'Você ficou sem internet e a chamada caiu.'
  return 'A conexão com o servidor de voz caiu e não voltou (internet instável?).'
}

/**
 * Erro ao entrar na sala de voz, em português. null = cancelado por nós
 * (saiu ou tentou de novo no meio): não há o que mostrar.
 */
export function describeJoinError(err: unknown, online: boolean): string | null {
  if (!isLivekitConnectionError(err)) {
    return online ? 'Não foi possível conectar ao servidor de voz.' : OFFLINE_MESSAGE
  }
  switch (err.reason) {
    case LK_CONNECTION_ERROR.Cancelled:
      return null
    case LK_CONNECTION_ERROR.NotAllowed:
      return 'O servidor de voz recusou a entrada (acesso negado). Tente entrar de novo.'
    case LK_CONNECTION_ERROR.Timeout:
      return online
        ? 'O servidor de voz demorou demais para responder (internet lenta?).'
        : OFFLINE_MESSAGE
    case LK_CONNECTION_ERROR.LeaveRequest:
      return describeDisconnect(typeof err.context === 'number' ? err.context : undefined, online)
    case LK_CONNECTION_ERROR.ServiceNotFound:
      return 'Servidor de voz indisponível no momento.'
    case LK_CONNECTION_ERROR.ServerUnreachable:
    case LK_CONNECTION_ERROR.WebSocket:
      return online ? UNREACHABLE_MESSAGE : OFFLINE_MESSAGE
    case LK_CONNECTION_ERROR.InternalError:
      // O controle abriu, mas a conexão de mídia (WebRTC) não: quase sempre UDP.
      if (/could not establish/i.test(err.message)) return UDP_BLOCKED_MESSAGE
      return 'Erro no servidor de voz. Tente de novo em instantes.'
  }
  return online ? 'Não foi possível conectar ao servidor de voz.' : OFFLINE_MESSAGE
}

/** Erro ao pedir o acesso (token) ao nosso servidor. `status` 0 = sem resposta. */
export function describeTokenError(status: number | null, online: boolean): string {
  if (!online) return OFFLINE_MESSAGE
  if (status === 403) return 'Você não tem mais acesso a esta chamada.'
  if (status === 404) return 'A chamada já terminou.'
  if (status === null || status === 0) {
    return 'O servidor não respondeu a tempo (internet lenta?). Tente de novo.'
  }
  return 'Não foi possível entrar na chamada agora. Tente de novo.'
}

export type CallConnectionTone = 'ok' | 'pending' | 'error'

export interface CallConnectionView {
  heading: string
  tone: CallConnectionTone
  /** Explicação (demora ou erro). */
  detail: string | null
  /** Mostra "Tentar de novo" / "Sair". */
  offerRetry: boolean
}

function slowReason(step: CallJoinStep | null, online: boolean): string {
  if (!online) return 'Você está sem internet. A chamada conecta quando ela voltar.'
  switch (step) {
    case 'token':
      return 'O servidor está demorando para responder. Sua internet pode estar lenta.'
    case 'signal':
      return 'O servidor de voz não responde. Sua internet pode estar lenta ou instável.'
    case 'media':
      return 'O servidor de voz respondeu, mas o áudio não conecta. A rede pode estar bloqueando UDP (VPN, rede de empresa ou de escola).'
    default:
      return 'Está demorando mais que o normal. Sua internet pode estar lenta.'
  }
}

/** O que o painel "Voz conectada" mostra para a conexão de voz agora. */
export function callConnectionView(
  state: CallConnection,
  now: number,
  online: boolean
): CallConnectionView {
  const slow = now - state.since >= CALL_SLOW_MS
  switch (state.phase) {
    case 'idle':
      // Chamada aceita, mídia ainda não começou (instantes).
      return { heading: 'Conectando à chamada…', tone: 'pending', detail: null, offerRetry: false }
    case 'connecting':
      return {
        heading: 'Conectando à chamada…',
        tone: 'pending',
        detail: slow || !online ? slowReason(state.step, online) : null,
        offerRetry: slow
      }
    case 'reconnecting':
      return {
        heading: 'Reconectando à chamada…',
        tone: 'pending',
        detail: slow
          ? online
            ? 'A conexão caiu e ainda não voltou. Sua internet pode estar instável.'
            : 'Você está sem internet. A chamada volta quando ela voltar.'
          : null,
        offerRetry: slow
      }
    case 'failed':
      return {
        heading: 'Falha na conexão de voz',
        tone: 'error',
        detail: state.error,
        offerRetry: true
      }
    case 'connected':
      return { heading: 'Voz conectada', tone: 'ok', detail: null, offerRetry: false }
  }
}

/** Quando a tela precisa reavaliar sozinha (a fase passa a contar como lenta). */
export function nextCallConnectionChange(state: CallConnection, now: number): number | null {
  if (state.phase !== 'connecting' && state.phase !== 'reconnecting') return null
  const at = state.since + CALL_SLOW_MS
  return at > now ? at : null
}
