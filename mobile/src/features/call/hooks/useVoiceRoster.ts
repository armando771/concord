import { useEffect, useState } from 'react'
import { onRealtimeReconnect } from '../../../shared/api/realtime'
import { listServerCalls } from '../api/calls'
import type { CallUser } from '../lib/callTypes'
import { rosterFromCalls } from '../lib/voiceRoster'
import { useCallSessionStore } from '../store/callSessionStore'

const REFRESH_MS = 20_000

/** Quem está em cada canal de voz do servidor aberto: busca ao abrir, a cada 20 s, ao reconectar e quando entro ou saio de uma chamada. */
export function useVoiceRoster(serverId: string | null): Record<string, CallUser[]> {
  const [roster, setRoster] = useState<Record<string, CallUser[]>>({})
  const callId = useCallSessionStore((s) => s.callId)

  useEffect(() => {
    if (!serverId) {
      setRoster({})
      return
    }
    let active = true
    const refresh = (): void => {
      listServerCalls(serverId)
        .then((calls) => active && setRoster(rosterFromCalls(calls)))
        .catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    const offReconnect = onRealtimeReconnect(refresh)
    return () => {
      active = false
      clearInterval(timer)
      offReconnect()
    }
  }, [serverId, callId])

  return roster
}
