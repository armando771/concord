import { useEffect, useState } from 'react'
import type { CallKind } from '../../store/callStore'

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function useElapsed(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (startedAt === null) {
      const reset = setTimeout(() => setElapsed(0), 0)
      return () => clearTimeout(reset)
    }
    const tick = (): void => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    const initial = setTimeout(tick, 0)
    const timer = setInterval(tick, 1000)
    return () => {
      clearTimeout(initial)
      clearInterval(timer)
    }
  }, [startedAt])
  return elapsed
}

/** Rota da tela da chamada atual (canal de voz ou DM), ou null sem dados para chegar lá. */
export function callRoute(call: {
  type: CallKind | null
  serverId: string | null
  channelId: string | null
  peerId: string | null
}): string | null {
  if (call.type === 'channel' && call.serverId && call.channelId) {
    return `/servers/${call.serverId}/channels/${call.channelId}`
  }
  if (call.type === 'dm' && call.peerId) return `/dm/${call.peerId}`
  return null
}
