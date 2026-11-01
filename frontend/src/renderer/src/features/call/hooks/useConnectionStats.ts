import { useEffect, useState } from 'react'
import type { AppMetrics } from '../../../../../shared/appMetrics'
import { readCallLatency } from '../store/callStore'
import {
  appendPing,
  CONNECTION_SAMPLE_MS,
  pingScale,
  type PingSample
} from '../lib/connectionStats'

interface ConnectionStats {
  history: PingSample[]
  ceiling: number
  metrics: AppMetrics | null
  pending: boolean
  warmingCPU: boolean
}

/** Montado apenas com o popover aberto; nenhuma coleta de fundo ou store global. */
export function useConnectionStats(): ConnectionStats {
  const [stats, setStats] = useState<ConnectionStats>({
    history: [],
    ceiling: 100,
    metrics: null,
    pending: true,
    warmingCPU: true
  })

  useEffect(() => {
    let disposed = false
    let busy = false
    let revision = 0
    let reset = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const sample = async (): Promise<void> => {
      if (disposed || document.hidden || busy) return
      busy = true
      const currentRevision = revision
      const baseline = reset
      reset = false
      try {
        const [ms, metrics] = await Promise.all([
          readCallLatency().catch(() => null),
          window.api?.appMetrics?.sample(baseline).catch(() => null) ?? Promise.resolve(null)
        ])
        if (disposed || document.hidden || currentRevision !== revision) return
        setStats((previous) => {
          const history = appendPing(previous.history, { time: Date.now(), ms })
          return {
            history,
            ceiling: pingScale(history, previous.ceiling),
            metrics,
            warmingCPU: baseline && metrics !== null && metrics.cpuPercent === null,
            pending: false
          }
        })
      } finally {
        busy = false
        if (!disposed && !document.hidden) {
          timer = setTimeout(
            () => void sample(),
            currentRevision === revision ? CONNECTION_SAMPLE_MS : 0
          )
        }
      }
    }

    const onVisibility = (): void => {
      revision++
      reset = true
      clearTimeout(timer)
      if (!document.hidden) void sample()
    }
    document.addEventListener('visibilitychange', onVisibility)
    void sample()
    return () => {
      disposed = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return stats
}
