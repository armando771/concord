export const CONNECTION_SAMPLE_MS = 2000
export const CONNECTION_HISTORY_SIZE = 30

export interface PingSample {
  time: number
  ms: number | null
}

function milliseconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value * 1000 : null
}

/** Prefere o par ICE selecionado. remote-inbound-rtp mede RTT de RTCP até o SFU. */
export function reportLatency(report: RTCStatsReport): number | null {
  let selected: number | null = null
  let nominated: number | null = null
  let rtcp: number | null = null
  report.forEach((stat) => {
    if (stat.type === 'transport' && stat.selectedCandidatePairId) {
      const pair = report.get(stat.selectedCandidatePairId)
      if (pair) selected = milliseconds(pair.currentRoundTripTime)
    }
    if (stat.type === 'candidate-pair' && stat.nominated && stat.state === 'succeeded') {
      nominated = milliseconds(stat.currentRoundTripTime)
    }
    if (stat.type === 'remote-inbound-rtp' && stat.roundTripTimeMeasurements !== 0) {
      rtcp = milliseconds(stat.roundTripTime) ?? rtcp
    }
  })
  return selected ?? nominated ?? rtcp
}

export function appendPing(history: PingSample[], sample: PingSample): PingSample[] {
  const start = sample.time - (CONNECTION_HISTORY_SIZE - 1) * CONNECTION_SAMPLE_MS
  return [...history.filter((point) => point.time >= start), sample].slice(-CONNECTION_HISTORY_SIZE)
}

export function averagePing(history: PingSample[]): number | null {
  const values = history.flatMap((sample) => (sample.ms === null ? [] : [sample.ms]))
  return values.length ? values.reduce((sum, ms) => sum + ms, 0) / values.length : null
}

/** Só sobe enquanto o popover está aberto, sem oscilar a cada amostra. */
export function pingScale(history: PingSample[], previous = 100): number {
  const max = Math.max(0, ...history.map((sample) => sample.ms ?? 0))
  const step = max <= 200 ? 50 : max <= 1000 ? 250 : 1000
  return Math.max(previous, Math.ceil(max / step) * step)
}

/** Lacunas de medição ou pausa da coleta iniciam um segmento novo. */
export function pingSegments(history: PingSample[], ceiling: number): string[] {
  const end = history.at(-1)?.time ?? 0
  const start = end - (CONNECTION_HISTORY_SIZE - 1) * CONNECTION_SAMPLE_MS
  const segments: string[] = []
  let points: string[] = []
  let lastTime = 0
  const flush = (): void => {
    if (points.length) segments.push(points.join(' '))
    points = []
  }
  for (const sample of history) {
    if (sample.ms === null || sample.time - lastTime > CONNECTION_SAMPLE_MS * 1.75) flush()
    if (sample.ms !== null) {
      const x = Math.max(0, Math.min(240, ((sample.time - start) / (end - start)) * 240))
      const y = 72 - (Math.min(sample.ms, ceiling) / ceiling) * 72
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    lastTime = sample.time
  }
  flush()
  return segments
}
