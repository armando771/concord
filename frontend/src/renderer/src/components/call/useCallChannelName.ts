import { useEffect, useSyncExternalStore } from 'react'
import { listChannels } from '../../api/channels'
import { useServerStore } from '../../store/serverStore'

/**
 * Nomes de canais já vistos. O serverStore só tem os canais do servidor
 * aberto; a chamada continua quando você vai para outro servidor ou para as
 * DMs, e o painel ainda precisa do nome.
 */
const knownNames = new Map<string, string>()
/** Servidores com a lista de canais já pedida (uma vez só). */
const requested = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function learn(channels: { id: string; name: string }[]): void {
  channels.forEach((c) => knownNames.set(c.id, c.name))
  version++
  listeners.forEach((l) => l())
}

/** Nome do canal da chamada, de qualquer tela (null enquanto não se sabe). */
export function useCallChannelName(
  serverId: string | null,
  channelId: string | null
): string | null {
  const fromStore = useServerStore((s) =>
    channelId ? s.channels.find((c) => c.id === channelId)?.name : undefined
  )
  useSyncExternalStore(subscribe, () => version)

  if (channelId && fromStore) knownNames.set(channelId, fromStore)
  const known = channelId ? knownNames.get(channelId) : undefined

  useEffect(() => {
    if (!serverId || !channelId || known || requested.has(serverId)) return
    requested.add(serverId)
    listChannels(serverId)
      .then(learn)
      .catch(() => {
        // fica o "Canal de voz"; tenta de novo na próxima vez que montar
        requested.delete(serverId)
      })
  }, [serverId, channelId, known])

  return fromStore ?? known ?? null
}
