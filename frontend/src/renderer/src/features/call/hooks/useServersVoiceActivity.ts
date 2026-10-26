import { useEffect, useState } from 'react'
import { listActiveServerCalls } from '../api/calls'
import { hasVoiceParticipants } from '../lib/voiceServer'
import { useCallStore } from '../store/callStore'

const REFRESH_MS = 10000

// Servidores com gente em canal de voz (inclusive quando eu não estou na chamada).
export function useServersVoiceActivity(serverIds: string[]): Set<string> {
  const [active, setActive] = useState<Set<string>>(new Set())
  const listVersion = useCallStore((s) => s.listVersion)
  const key = serverIds.join(',')

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const refresh = (): void => {
      Promise.all(
        key.split(',').map((id) =>
          listActiveServerCalls(id)
            .then((states) => (hasVoiceParticipants(states) ? id : null))
            .catch(() => null)
        )
      ).then((ids) => {
        if (!cancelled) setActive(new Set(ids.filter((id): id is string => id !== null)))
      })
    }
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [key, listVersion])

  return active
}
