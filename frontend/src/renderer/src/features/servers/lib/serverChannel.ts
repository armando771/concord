import { primaryChannelId } from './primaryChannel'

interface ChannelLike {
  id: string
  server_id: string
  type: string
  created_at?: string
}

/**
 * Canal de texto que abre ao entrar num servidor sem canal na rota: o último
 * visitado (se ainda existe), senão o principal/primeiro de texto. Só olha
 * canais do próprio servidor — a lista do store pode ainda ser do servidor
 * anterior enquanto a nova carrega, e usá-la abria o chat do servidor errado.
 */
export function resolveServerChannel(
  serverId: string,
  server: { id: string; primary_channel_id?: string | null } | null | undefined,
  channels: ChannelLike[],
  lastVisitedId?: string | null
): string | null {
  const own = channels.filter((c) => c.server_id === serverId)
  if (own.length === 0) return null
  if (lastVisitedId && own.some((c) => c.id === lastVisitedId && (c.type ?? 'text') === 'text')) {
    return lastVisitedId
  }
  return primaryChannelId(server?.id === serverId ? server : null, own)
}

const lastVisited = new Map<string, string>()

export function rememberServerChannel(serverId: string, channelId: string): void {
  lastVisited.set(serverId, channelId)
}

export function lastServerChannel(serverId: string): string | null {
  return lastVisited.get(serverId) ?? null
}
