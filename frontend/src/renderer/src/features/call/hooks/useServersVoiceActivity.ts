import { useEffect, useState } from 'react'
import { listActiveServerCalls } from '../api/calls'
import { voicePeople, type VoiceMember } from '../lib/voiceServer'
import { useCallStore } from '../store/callStore'

const REFRESH_MS = 10000

const NO_ACTIVITY = new Map<string, VoiceMember[]>()

// Quem está em canal de voz, por servidor (inclusive quando eu não estou na chamada).
// Só entram os servidores com gente: `activity.has(id)` diz se há call ativa.
export function useServersVoiceActivity(serverIds: string[]): Map<string, VoiceMember[]> {
  const [activity, setActivity] = useState<Map<string, VoiceMember[]>>(NO_ACTIVITY)
  const listVersion = useCallStore((s) => s.listVersion)
  const key = serverIds.join(',')

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const refresh = (): void => {
      Promise.all(
        key.split(',').map((id) =>
          listActiveServerCalls(id)
            .then((states) => [id, voicePeople(states)] as const)
            .catch(() => [id, [] as VoiceMember[]] as const)
        )
      ).then((entries) => {
        if (!cancelled) setActivity(new Map(entries.filter(([, people]) => people.length > 0)))
      })
    }
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [key, listVersion])

  return activity
}
