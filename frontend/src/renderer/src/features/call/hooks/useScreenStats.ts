import { useEffect, useState } from 'react'
import { screenStatsView, type ScreenStatsSample, type ScreenStatsView } from '../lib/screenStats'
import { readActiveScreenStats } from '../lib/screenStatsSource'

export const SCREEN_STATS_MS = 1000

/** null = medindo (primeira leitura). Montado só com o painel aberto. */
export function useScreenStats(userId: string, local: boolean): ScreenStatsView | null {
  const [view, setView] = useState<ScreenStatsView | null>(null)

  useEffect(() => {
    let disposed = false
    let previous: ScreenStatsSample | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const sample = async (): Promise<void> => {
      try {
        const input = await readActiveScreenStats(userId, local).catch(() => null)
        if (disposed) return
        if (!input) {
          previous = null
          setView({ rows: [], status: 'Transmissão indisponível' })
          return
        }
        const next = screenStatsView(input, previous)
        previous = next.sample
        setView(next.view)
      } finally {
        if (!disposed) timer = setTimeout(() => void sample(), SCREEN_STATS_MS)
      }
    }
    void sample()
    return () => {
      disposed = true
      clearTimeout(timer)
    }
  }, [userId, local])

  return view
}
