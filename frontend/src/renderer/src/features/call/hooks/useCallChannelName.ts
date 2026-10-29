import { useEffect } from 'react'
import { listChannels } from '../../servers/api/channels'
import { useServerStore } from '../../servers/store/serverStore'
import {
  CHANNEL_NAMES_TTL_MS,
  channelNamesStale,
  useChannelNameStore
} from '../../servers/store/channelNameStore'

/** Servidores com a lista de canais a caminho (um pedido de cada vez). */
const inFlight = new Set<string>()

function fetchNames(serverId: string): void {
  if (inFlight.has(serverId)) return
  inFlight.add(serverId)
  listChannels(serverId)
    .then((channels) => useChannelNameStore.getState().learn(serverId, channels))
    .catch(() => {
      // fica o nome que já havia (ou "Canal de voz"); tenta de novo depois
    })
    .finally(() => inFlight.delete(serverId))
}

/**
 * Nome do canal da chamada, de qualquer tela (null enquanto não se sabe). No
 * servidor aberto vem do serverStore; fora dele, da lista do servidor da
 * chamada, buscada de novo quando um canal muda ou a cada minuto.
 */
export function useCallChannelName(
  serverId: string | null,
  channelId: string | null
): string | null {
  const openChannels = useServerStore((s) =>
    serverId && s.currentServer?.id === serverId ? s.channels : null
  )
  const fromOpen = channelId
    ? openChannels?.find((c) => c.id === channelId && c.server_id === serverId)?.name
    : undefined
  const cached = useChannelNameStore((s) =>
    serverId && channelId ? s.nameOf(serverId, channelId) : null
  )
  const fetchedAt = useChannelNameStore((s) => (serverId ? s.fetchedAt[serverId] : undefined))

  // Servidor aberto: a lista dele já está fresca, vira o cache. (Logo depois
  // de trocar de servidor a lista ainda pode ser a do anterior: ignora.)
  useEffect(() => {
    if (!serverId || !openChannels) return
    const mine = openChannels.filter((c) => c.server_id === serverId)
    if (mine.length > 0) useChannelNameStore.getState().learn(serverId, mine)
  }, [serverId, openChannels])

  // Fora dele: busca se nunca buscou, se um evento invalidou ou se expirou.
  const away = openChannels === null
  useEffect(() => {
    if (!serverId || !channelId || !away) return
    if (channelNamesStale(fetchedAt, Date.now())) fetchNames(serverId)
    const timer = setInterval(() => fetchNames(serverId), CHANNEL_NAMES_TTL_MS)
    return () => clearInterval(timer)
  }, [serverId, channelId, away, fetchedAt])

  return fromOpen ?? cached
}
