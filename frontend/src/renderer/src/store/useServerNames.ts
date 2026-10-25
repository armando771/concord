import { useCallStore } from './callStore'
import { useServerStore } from './serverStore'

/**
 * Apelidos do servidor (userId -> apelido), ou undefined fora de servidor
 * (DM, grupo, amigos): aí ninguém tem apelido. Use com serverDisplayName.
 */
export function useServerNicknames(
  serverId: string | null | undefined
): Record<string, string> | undefined {
  return useServerStore((s) => (serverId ? s.nicknames[serverId] : undefined))
}

/** Apelido de uma pessoa no servidor (undefined se não tem ou fora de servidor). */
export function useServerNickname(
  serverId: string | null | undefined,
  userId: string | null | undefined
): string | undefined {
  return useServerStore((s) => (serverId && userId ? s.nicknames[serverId]?.[userId] : undefined))
}

/**
 * Apelidos do servidor da call em que estou (canal de voz), mesmo que eu
 * esteja olhando outro servidor. Call de DM: undefined (sem apelido).
 */
export function useCallNicknames(): Record<string, string> | undefined {
  const serverId = useCallStore((s) => (s.type === 'channel' ? s.serverId : null))
  return useServerNicknames(serverId)
}
