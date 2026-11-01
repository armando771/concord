/**
 * Quando a animação de subir de nível pode tocar. Com a janela fora de vista
 * (alt-tab, minimizada, escondida na bandeja) ninguém ia ver a celebração nem
 * ouvir o jingle: ela entra numa fila e toca quando a pessoa volta.
 */

/** Idade máxima de uma subida na fila; mais velha que isso já não tem graça. */
export const PENDING_MAX_AGE_MS = 10 * 60 * 1000

/** Intervalo mínimo entre dois "tocar de novo" (clique no selo do cartão). */
export const REPLAY_COOLDOWN_MS = 3000

export interface WindowAttention {
  /** document.hasFocus(): a janela está em primeiro plano. */
  focused: boolean
  /** document.visibilityState === 'visible'. */
  visible: boolean
}

/** A pessoa está olhando para o app (com foco e visível)? */
export function isAttentive(window: WindowAttention): boolean {
  return window.focused && window.visible
}

/** Estado atual da janela; fora do navegador (testes em node) conta como presente. */
export function readAttention(): WindowAttention {
  if (typeof document === 'undefined') return { focused: true, visible: true }
  return { focused: document.hasFocus(), visible: document.visibilityState === 'visible' }
}

export interface PendingLevelUp {
  level: number
  /** Nível de antes da primeira subida da fila (para achar o marco cruzado). */
  previous: number
  /** Quando entrou na fila a subida mais alta. */
  queuedAt: number
}

/**
 * Põe uma subida na fila. Várias viram uma só: a do nível mais alto (a que
 * vale a pena mostrar), lembrando o nível mais baixo de onde se partiu.
 */
export function queueLevelUp(
  pending: PendingLevelUp | null,
  incoming: { level: number; previous: number },
  now: number
): PendingLevelUp {
  if (!pending) return { level: incoming.level, previous: incoming.previous, queuedAt: now }
  const previous = Math.min(pending.previous, incoming.previous)
  if (incoming.level > pending.level) return { level: incoming.level, previous, queuedAt: now }
  return { ...pending, previous }
}

export type PendingAction = 'wait' | 'play' | 'drop'

/** O que fazer com a subida da fila: esperar a volta, tocar agora ou descartar. */
export function resolvePending(
  pending: PendingLevelUp | null,
  window: WindowAttention,
  now: number
): PendingAction {
  if (!pending) return 'wait'
  if (now - pending.queuedAt > PENDING_MAX_AGE_MS) return 'drop'
  return isAttentive(window) ? 'play' : 'wait'
}

/** Passou o intervalo desde o último "tocar de novo"? */
export function canReplay(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= REPLAY_COOLDOWN_MS || now < lastAt
}
