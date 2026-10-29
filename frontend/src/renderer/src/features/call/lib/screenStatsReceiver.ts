import {
  bitrate,
  codecImplementation,
  codecName,
  decimal,
  fps,
  num,
  resolution,
  text,
  type ScreenStatsSample,
  type Stat,
  type StatRow
} from './screenStatsFormat'

// Linhas do painel "Recebendo" (a live de outra pessoa). Puro.

function lossPercent(now: ScreenStatsSample, prev: ScreenStatsSample | null): string {
  const lost = now.packetsLost - (prev?.packetsLost ?? 0)
  const total = lost + now.packetsReceived - (prev?.packetsReceived ?? 0)
  return total > 0 ? `${decimal((Math.max(0, lost) * 100) / total)}%` : '—'
}

function freezes(stat: Stat): string {
  const count = num(stat.freezeCount)
  if (count === null) return '—'
  const seconds = num(stat.totalFreezesDuration) ?? 0
  return count > 0 ? `${count} (${decimal(seconds)} s)` : '0'
}

export function receiverRows(
  report: RTCStatsReport,
  stat: Stat,
  now: ScreenStatsSample,
  prev: ScreenStatsSample | null
): StatRow[] {
  const jitter = num(stat.jitter)
  const decoder = codecImplementation(
    text(stat.decoderImplementation),
    stat.powerEfficientDecoder as boolean | undefined
  )
  return [
    { label: 'Quadros', value: `${fps(stat)} fps` },
    { label: 'Resolução', value: resolution(stat) },
    { label: 'Taxa', value: bitrate(now, prev) },
    { label: 'Codec', value: codecName(report, stat, decoder) },
    { label: 'Decodificador', value: decoder },
    { label: 'Perda', value: lossPercent(now, prev) },
    { label: 'Jitter', value: jitter === null ? '—' : `${Math.round(jitter * 1000)} ms` },
    { label: 'Descartados', value: String(num(stat.framesDropped) ?? '—') },
    { label: 'Congelamentos', value: freezes(stat) }
  ]
}
