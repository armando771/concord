import type { Friend, PendingRequest, SendRequestResult } from '../api/friends'
import type { PresenceStatus } from './presenceStatus'

const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Ordem alfabética, sem acento nem maiúsculas (não muda a lista de entrada). */
export function sortByName<T extends { display_name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => normalize(a.display_name).localeCompare(normalize(b.display_name)))
}

/** Amigos que estão online, ausentes ou em não perturbe (offline e sem status ficam de fora). */
export function onlineFriends(friends: Friend[], statuses: Record<string, PresenceStatus>): Friend[] {
  return sortByName(friends.filter((f) => (statuses[f.id] ?? 'offline') !== 'offline'))
}

export function splitPending(pending: PendingRequest[]): { incoming: PendingRequest[]; outgoing: PendingRequest[] } {
  return {
    incoming: sortByName(pending.filter((p) => p.direction === 'incoming')),
    outgoing: sortByName(pending.filter((p) => p.direction === 'outgoing'))
  }
}

export function addSuccessMessage(result: SendRequestResult, name: string): string {
  return result === 'accepted' ? `Agora você e ${name} são amigos.` : `Pedido enviado para ${name}.`
}

const SEND_FAILED = 'Não foi possível enviar o pedido.'

/** Mensagem do erro de "Adicionar amigo": só os códigos que o backend distingue; o resto é genérico. */
export function addFailureMessage(error: unknown): string {
  const code = (error as { code?: string } | null | undefined)?.code
  if (code === 'user_not_found') return 'Usuário não encontrado.'
  if (code === 'already_friends') return 'Vocês já são amigos.'
  return SEND_FAILED
}
