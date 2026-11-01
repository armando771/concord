// Estado da conexão do chat (WebSocket) e o aviso no topo do app. Puro: quem
// chama passa a hora e se o navegador está online.

/** Sem conexão por mais que isso: aparece "Sem conexão — tentando reconectar…". */
export const LOST_NOTICE_DELAY_MS = 1500
/** Reinício planejado (1012): um deploy leva menos que isso, então só avisa se passar. */
export const RESTART_NOTICE_DELAY_MS = 3000
/** Quanto tempo o "Reconectado" fica na tela. */
export const RECONNECTED_NOTICE_MS = 2500

export type WsPhase = 'idle' | 'connecting' | 'open' | 'lost'

export interface WsStatus {
  phase: WsPhase
  /** Início da queda atual (null fora de 'lost'). */
  lostAt: number | null
  /** O servidor avisou que estava reiniciando (close 1012). */
  planned: boolean
  /** Tentativa de reconexão agendada/em andamento (1 = a primeira). */
  attempt: number
  /** Voltou depois de um aviso visível: mostra "Reconectado" por um instante. */
  reconnectedAt: number | null
}

export type WsStatusEvent =
  | { type: 'connect' }
  | { type: 'open' }
  | { type: 'lost'; planned: boolean; attempt: number }
  | { type: 'stop' }

export const INITIAL_WS_STATUS: WsStatus = {
  phase: 'idle',
  lostAt: null,
  planned: false,
  attempt: 0,
  reconnectedAt: null
}

export type ConnectionBanner =
  | { kind: 'offline' }
  | { kind: 'lost'; attempt: number }
  | { kind: 'restarting' }
  | { kind: 'reconnected' }

/** Aviso a mostrar agora (null = nenhum). */
export function connectionBanner(
  status: WsStatus,
  online: boolean,
  now: number
): ConnectionBanner | null {
  if (status.phase === 'idle') return null
  if (!online) return { kind: 'offline' }
  if (status.phase === 'lost' && status.lostAt !== null) {
    const elapsed = now - status.lostAt
    if (status.planned) return elapsed >= RESTART_NOTICE_DELAY_MS ? { kind: 'restarting' } : null
    return elapsed >= LOST_NOTICE_DELAY_MS
      ? { kind: 'lost', attempt: Math.max(1, status.attempt) }
      : null
  }
  if (
    status.phase === 'open' &&
    status.reconnectedAt !== null &&
    now - status.reconnectedAt < RECONNECTED_NOTICE_MS
  ) {
    return { kind: 'reconnected' }
  }
  return null
}

/**
 * Quando o aviso pode mudar sozinho (fim de uma espera); null = só muda com
 * um evento. A tela agenda um timer para essa hora.
 */
export function nextBannerChange(status: WsStatus, online: boolean, now: number): number | null {
  if (status.phase === 'idle' || !online) return null
  if (status.phase === 'lost' && status.lostAt !== null) {
    const at = status.lostAt + (status.planned ? RESTART_NOTICE_DELAY_MS : LOST_NOTICE_DELAY_MS)
    return at > now ? at : null
  }
  if (status.phase === 'open' && status.reconnectedAt !== null) {
    const at = status.reconnectedAt + RECONNECTED_NOTICE_MS
    return at > now ? at : null
  }
  return null
}

export function wsStatusReducer(
  status: WsStatus,
  event: WsStatusEvent,
  now: number,
  online: boolean
): WsStatus {
  switch (event.type) {
    case 'connect':
      return { ...INITIAL_WS_STATUS, phase: 'connecting' }
    case 'stop':
      return INITIAL_WS_STATUS
    case 'lost':
      if (status.phase === 'idle') return status
      return {
        phase: 'lost',
        lostAt: status.phase === 'lost' && status.lostAt !== null ? status.lostAt : now,
        planned: event.planned,
        attempt: event.attempt,
        reconnectedAt: null
      }
    case 'open': {
      if (status.phase === 'idle') return status
      const shown = connectionBanner(status, online, now)
      const wasWarning = shown !== null && shown.kind !== 'reconnected'
      return {
        phase: 'open',
        lostAt: null,
        planned: false,
        attempt: 0,
        reconnectedAt: wasWarning ? now : null
      }
    }
  }
}
