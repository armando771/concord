import { ApiError } from '../../../shared/api/client'
import type { PendingRequest, RelationshipType } from '../../friends/api/friends'

/**
 * Relação com alguém pelo que o app já tem carregado (amigos, pedidos e
 * bloqueados), sem ir ao servidor.
 */
export function relationshipOf(
  userId: string,
  lists: {
    friends: { id: string }[]
    pending: Pick<PendingRequest, 'user_id' | 'direction'>[]
    blocked: { id: string }[]
  }
): RelationshipType {
  if (lists.blocked.some((u) => u.id === userId)) return 'blocked'
  if (lists.friends.some((u) => u.id === userId)) return 'friend'
  const request = lists.pending.find((p) => p.user_id === userId)
  if (request) return request.direction
  return 'none'
}

/** Mensagem do "Adicionar amigo" para um erro do servidor (como no Discord). */
export function friendRequestError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'user_not_found':
        return 'Hm, não funcionou. Confira se o nome de usuário está certo, com maiúsculas e minúsculas.'
      case 'already_friends':
        return 'Vocês já são amigos!'
      case 'request_exists':
        return 'Você já mandou um pedido de amizade para essa pessoa.'
      case 'you_blocked':
        return 'Você bloqueou essa pessoa. Desbloqueie para mandar o pedido.'
      case 'not_allowed':
        return 'Essa pessoa não está aceitando pedidos de amizade de você.'
      case 'self':
        return 'Você não pode mandar pedido de amizade para você mesmo.'
    }
    if (err.status === 0) return 'Sem conexão com o servidor.'
  }
  return 'Não foi possível enviar o pedido. Tente de novo.'
}
