// Reconexão do WebSocket do chat. No deploy o servidor fecha as conexões com
// 1012 ("servidor reiniciando") e volta em instantes: o app reconecta logo,
// sem o backoff normal e sem aviso na tela, a não ser que demore.

/** Código de fechamento que o backend manda ao reiniciar (Service Restart). */
export const SERVICE_RESTART_CLOSE_CODE = 1012

/** Sem conexão por mais que isso: aparece o aviso "Reconectando…". */
export const RECONNECT_NOTICE_DELAY_MS = 3000

const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30000
/** Primeira tentativa após o reinício: 100–300 ms, espalhando os clientes. */
const RESTART_FIRST_MIN_MS = 100
const RESTART_FIRST_JITTER_MS = 200
/** Se o servidor ainda não voltou (sem Caddy segurando): 250 ms, 500 ms, 1 s… */
const RESTART_BACKOFF_BASE_MS = 250

export function isPlannedRestart(closeCode: number): boolean {
  return closeCode === SERVICE_RESTART_CLOSE_CODE
}

/**
 * Espera antes da tentativa `attempt` (0 = a primeira depois da queda).
 * `planned` vale até a conexão voltar: as tentativas que falham no meio do
 * reinício chegam com outro código.
 */
export function reconnectDelay(
  attempt: number,
  planned: boolean,
  random: () => number = Math.random
): number {
  if (!planned) return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS)
  if (attempt === 0) return Math.round(RESTART_FIRST_MIN_MS + random() * RESTART_FIRST_JITTER_MS)
  const base = Math.min(RESTART_BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_MAX_MS)
  // ±25%: os clientes não voltam todos no mesmo milissegundo.
  return Math.round(Math.min(base * (0.75 + random() * 0.5), BACKOFF_MAX_MS))
}

export interface ReconnectNotice {
  /** A conexão caiu (ou uma tentativa falhou). */
  lost: () => void
  /** Conectou de novo. */
  restored: () => void
  /** Saiu da conta: nada de aviso pendente. */
  cancel: () => void
}

/**
 * Avisa só se a conexão ficar fora por mais de `delayMs` (um deploy leva bem
 * menos): `onSlow` uma vez; `onBack` ao voltar, só se `onSlow` foi chamado.
 */
export function createReconnectNotice(handlers: {
  onSlow: () => void
  onBack: () => void
  onDismiss?: () => void
  delayMs?: number
}): ReconnectNotice {
  const delayMs = handlers.delayMs ?? RECONNECT_NOTICE_DELAY_MS
  let timer: ReturnType<typeof setTimeout> | null = null
  let shown = false

  const clear = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  return {
    lost: () => {
      if (timer || shown) return
      timer = setTimeout(() => {
        timer = null
        shown = true
        handlers.onSlow()
      }, delayMs)
    },
    restored: () => {
      clear()
      if (!shown) return
      shown = false
      handlers.onBack()
    },
    cancel: () => {
      clear()
      if (shown) handlers.onDismiss?.()
      shown = false
    }
  }
}
