import { remoteEncoderRows, type ScreenEncoderInfo } from './screenEncoderInfo'
import {
  bitrate,
  codecImplementation,
  codecName,
  codecSubtype,
  decimal,
  fps,
  num,
  recoveryRows,
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

/**
 * O codec vem com onde QUEM TRANSMITE codifica (`encoder`, por RPC); o meu
 * decodificador fica na linha dele. Antes o "· processador" do decodificador
 * local parecia ser o codificador de quem transmite.
 */
/** Espera média no buffer de jitter (desde o início da recepção). */
function bufferDelay(stat: Stat): string {
  const delay = num(stat.jitterBufferDelay)
  const emitted = num(stat.jitterBufferEmittedCount)
  return delay === null || !emitted ? '—' : `${Math.round((delay / emitted) * 1000)} ms`
}

/** Decodificando pelo processador e há o que instalar para usar a placa: a dica. */
export function receiverNote(stat: Stat, hint: string | null): string | null {
  const decoder = codecImplementation(
    text(stat.decoderImplementation),
    stat.powerEfficientDecoder as boolean | undefined
  )
  return hint && decoder.startsWith('Software') ? hint : null
}

export function receiverRows(
  report: RTCStatsReport,
  encoder: ScreenEncoderInfo | null,
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
    { label: 'Codec', value: codecName(report, stat, '') },
    ...remoteEncoderRows(encoder, codecSubtype(report, stat) ?? ''),
    { label: 'Decodificador', value: decoder },
    { label: 'Perda', value: lossPercent(now, prev) },
    { label: 'Jitter', value: jitter === null ? '—' : `${Math.round(jitter * 1000)} ms` },
    { label: 'Descartados', value: String(num(stat.framesDropped) ?? '—') },
    { label: 'Congelamentos', value: freezes(stat) },
    ...recoveryRows(stat, 'keyFramesDecoded'),
    // Chegaram cedo ou tarde demais para o buffer (fora de ordem/atrasados).
    { label: 'Fora de ordem', value: String(num(stat.packetsDiscarded) ?? '—') },
    { label: 'Buffer', value: bufferDelay(stat) }
  ]
}
