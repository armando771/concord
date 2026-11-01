import { friendRequestError } from '../../profile/lib/relationship'
import type { SendRequestResult } from '../api/friends'

export type AddFriendOutcome =
  { ok: true; name: string; accepted: boolean } | { ok: false; error: string }

/** Tira espaços e o "@" que a pessoa pode ter digitado. */
export const cleanUsername = (raw: string): string => raw.trim().replace(/^@/, '')

/** Manda o pedido de amizade; null = nada a enviar (campo vazio). */
export async function submitFriendRequest(
  send: (username: string) => Promise<SendRequestResult>,
  raw: string
): Promise<AddFriendOutcome | null> {
  const name = cleanUsername(raw)
  if (!name) return null
  try {
    return { ok: true, name, accepted: (await send(name)) === 'accepted' }
  } catch (err) {
    return { ok: false, error: friendRequestError(err) }
  }
}

/** O botão "Enviar pedido" só vale com um nome digitado e sem envio em andamento. */
export const canSubmitFriend = (raw: string, sending: boolean): boolean =>
  !sending && cleanUsername(raw) !== ''

/** Cores do campo e do texto de retorno conforme o resultado. */
export function feedbackTone(outcome: AddFriendOutcome | null): { border: string; text: string } {
  if (!outcome) return { border: 'border-black/40', text: '' }
  return outcome.ok
    ? { border: 'border-success', text: 'text-success' }
    : { border: 'border-danger', text: 'text-danger' }
}
