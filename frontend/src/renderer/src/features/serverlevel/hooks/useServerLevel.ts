import { useEffect } from 'react'
import { useServerLevelStore } from '../store/serverLevelStore'
import type { ServerLevelProgress } from '../lib/serverLevel'

/** O nível do servidor, carregado ao abrir; depois o WS mantém em dia. */
export function useServerLevel(serverId: string | undefined): ServerLevelProgress | undefined {
  const progress = useServerLevelStore((s) => (serverId ? s.byServer[serverId] : undefined))
  const load = useServerLevelStore((s) => s.load)
  useEffect(() => {
    if (serverId) void load(serverId)
  }, [serverId, load])
  return progress
}
