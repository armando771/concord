import type { Message } from '../api/messages'

/**
 * Ordem das mensagens numa sala: (created_at, id), igual ao keyset do backend
 * (ORDER BY created_at, id). Toda junção de listas — página inicial,
 * loadOlder, evento ao vivo — passa por mergeMessages, então a ordem na tela
 * nunca depende da ordem de chegada.
 */

/** Nanossegundos abaixo do milissegundo: o Postgres guarda microssegundos. */
function subMillis(iso: string): number {
  const frac = /\.(\d+)/.exec(iso)?.[1]
  if (!frac || frac.length <= 3) return 0
  return Number(frac.slice(3, 9).padEnd(6, '0'))
}

/**
 * Compara dois created_at ISO 8601 pelo instante, não pelo texto: o Go corta
 * zeros da fração ("…00.12Z" vs "…00.123456Z") e pode mandar fuso (-03:00).
 */
export function compareTimestamps(a: string, b: string): number {
  const ms = Date.parse(a) - Date.parse(b)
  if (ms !== 0 && !Number.isNaN(ms)) return ms
  return subMillis(a) - subMillis(b)
}

export function compareMessages(a: Message, b: Message): number {
  const byTime = compareTimestamps(a.created_at, b.created_at)
  if (byTime !== 0) return byTime
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Junta `incoming` em `existing`: uma entrada por id (a cópia que chegou por
 * último vence) e tudo em ordem (created_at, id). Entradas não precisam estar
 * ordenadas — páginas da API vêm da mais nova para a mais antiga.
 */
export function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return existing
  const byId = new Map<string, Message>()
  for (const m of existing) byId.set(m.id, m)
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort(compareMessages)
}
