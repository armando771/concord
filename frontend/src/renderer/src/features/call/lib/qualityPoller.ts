import { isPoorQuality, QUALITY_STATS_INTERVAL_MS } from './connectionQuality'
import type { CallQuality, QualityDetails } from './connectionQuality'

export interface QualitySource {
  getQualityDetails(
    userIds: string[],
    selfId: string | null
  ): Promise<Record<string, QualityDetails>>
}

export interface QualityPollerDeps<C extends QualitySource> {
  /** A conexão ainda é a da chamada (senão o poller para sozinho). */
  isCurrent: (connection: C) => boolean
  quality: () => Record<string, CallQuality>
  details: () => Record<string, QualityDetails>
  selfId: () => string | null
  setDetails: (details: Record<string, QualityDetails>) => void
}

/**
 * Mede perda/latência de quem está com conexão ruim (para o tooltip). Só lê as
 * estatísticas quando há alguém ruim: nada a fazer na chamada boa.
 */
export function createQualityPoller<C extends QualitySource>(
  deps: QualityPollerDeps<C>
): { start: (connection: C) => void; stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null
  const stop = (): void => {
    if (timer) clearInterval(timer)
    timer = null
  }
  const start = (connection: C): void => {
    stop()
    let busy = false
    timer = setInterval(() => {
      if (!deps.isCurrent(connection)) {
        stop()
        return
      }
      const poor = Object.entries(deps.quality())
        .filter(([, quality]) => isPoorQuality(quality))
        .map(([userId]) => userId)
      if (poor.length === 0) {
        if (Object.keys(deps.details()).length > 0) deps.setDetails({})
        return
      }
      if (busy) return
      busy = true
      void connection
        .getQualityDetails(poor, deps.selfId())
        .then((details) => {
          if (deps.isCurrent(connection)) deps.setDetails(details)
        })
        .catch(() => {})
        .finally(() => {
          busy = false
        })
    }, QUALITY_STATS_INTERVAL_MS)
  }
  return { start, stop }
}
