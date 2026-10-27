import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listActiveServerCalls } from '../../call/api/calls'
import { useCallStore } from '../../call/store/callStore'
import { useAuthStore } from '../../auth/store/authStore'
import { voiceMembers } from '../../call/lib/recentArrivals'
import { useRecentArrivalsStore } from '../../call/store/recentArrivalsStore'
import { useLevelStore } from '../../levels/store/levelStore'
import { callsByChannel, voiceUserIdsKey } from '../lib/channelSidebar'

/**
 * Quem está nos canais de voz do servidor aberto. As chamadas ativas vão para
 * o callStore (a tela do canal também usa), relidas a cada 10 s e quando a
 * lista muda; os níveis de quem está em voz vêm num pedido só; e o pedido para
 * entrar numa sala trancada, quando aceito, leva para o canal.
 */
export function useServerCallsSync(serverId: string | undefined): void {
  const navigate = useNavigate()
  const listVersion = useCallStore((s) => s.listVersion)
  const usersKey = useCallStore((s) => voiceUserIdsKey(s.serverCalls))
  const admittedChannelId = useCallStore((s) => s.admittedChannelId)
  const clearAdmittedChannel = useCallStore((s) => s.clearAdmittedChannel)
  const ensureLevels = useLevelStore((s) => s.ensureLevels)

  useEffect(() => {
    if (!serverId) return
    let cancelled = false
    const refresh = (): void => {
      listActiveServerCalls(serverId)
        .then((states) => {
          if (cancelled) return
          const calls = callsByChannel(states)
          useCallStore.getState().setServerCalls(calls)
          useRecentArrivalsStore
            .getState()
            .ingest(serverId, voiceMembers(calls), useAuthStore.getState().user?.id)
        })
        .catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 10000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [serverId, listVersion])

  useEffect(() => {
    if (usersKey) ensureLevels(usersKey.split(','))
  }, [usersKey, ensureLevels])

  useEffect(() => {
    if (admittedChannelId && serverId) {
      navigate(`/servers/${serverId}/channels/${admittedChannelId}`)
      clearAdmittedChannel()
    }
  }, [admittedChannelId, serverId, navigate, clearAdmittedChannel])
}
