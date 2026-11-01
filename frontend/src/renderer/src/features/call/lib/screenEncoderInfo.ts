import {
  codecSubtype,
  implementationKind,
  num,
  text,
  type Stat,
  type StatRow
} from './screenStatsFormat'

// O codificador de quem transmite, para o painel "Recebendo" de quem assiste.
// O getStats() de quem assiste só conta o próprio decodificador; quem
// transmite resume o envio (codec, placa ou processador, degrau saindo) e
// responde por RPC (ver screenEncoderRpc). Puro.

export interface EncoderEntry {
  /** "H265": o subtipo do mimeType, em maiúsculas. */
  codec: string
  /** true = placa de vídeo; false = processador; null = o navegador não conta. */
  hardware: boolean | null
  height: number | null
  /** Quadros por segundo saindo agora. */
  fps: number | null
  /** Codec de reserva (para quem não decodifica o principal). */
  backup: boolean
}

export interface ScreenEncoderInfo {
  /** Degrau do principal saindo agora ("1080p 30"). */
  quality: string | null
  encoders: EncoderEntry[]
}

function entryOf(stat: Stat, codec: string, primary: string): EncoderEntry {
  const kind = implementationKind(
    text(stat.encoderImplementation) ?? '',
    stat.powerEfficientEncoder as boolean | undefined
  )
  const fps = num(stat.framesPerSecond)
  return {
    codec,
    hardware: kind === null ? null : kind === 'Hardware',
    height: num(stat.frameHeight),
    fps: fps === null ? null : Math.round(fps),
    backup: codec !== primary.toUpperCase()
  }
}

/** Um por codec ativo (com a camada extra de 720p, a maior). `primary`: 'h265'. */
export function encoderInfoFromReport(
  report: RTCStatsReport,
  quality: string | null,
  primary: string
): ScreenEncoderInfo {
  const byCodec = new Map<string, EncoderEntry>()
  report.forEach((stat: Stat) => {
    if (stat.type !== 'outbound-rtp' || stat.kind !== 'video' || stat.active === false) return
    const codec = codecSubtype(report, stat)
    if (!codec) return
    const entry = entryOf(stat, codec, primary)
    const seen = byCodec.get(codec)
    if (!seen || (entry.height ?? 0) > (seen.height ?? 0)) byCodec.set(codec, entry)
  })
  return { quality, encoders: [...byCodec.values()] }
}

const isEntry = (value: unknown): value is EncoderEntry => {
  const entry = value as EncoderEntry | null
  return typeof entry?.codec === 'string' && typeof entry.backup === 'boolean'
}

/** A resposta do outro lado; qualquer coisa fora do formato = null. */
export function parseEncoderInfo(payload: string): ScreenEncoderInfo | null {
  let value: Partial<ScreenEncoderInfo> | null
  try {
    value = JSON.parse(payload) as Partial<ScreenEncoderInfo> | null
  } catch {
    return null
  }
  const quality = value?.quality
  if (quality !== null && typeof quality !== 'string') return null
  if (!Array.isArray(value?.encoders) || !value.encoders.every(isEntry)) return null
  return { quality, encoders: value.encoders }
}

const CODEC_NAMES: Record<string, string> = { H264: 'H.264', H265: 'H.265' }
const PLACE = (hardware: boolean | null): string | null =>
  hardware === null ? null : hardware ? 'placa de vídeo' : 'processador'

/** Sua transmissão: "H.264 · placa de vídeo · 720p 30 fps" por reserva saindo. */
export function backupRows(info: ScreenEncoderInfo): StatRow[] {
  return info.encoders
    .filter((entry) => entry.backup)
    .map((entry) => {
      const size = entry.height && entry.fps !== null ? `${entry.height}p ${entry.fps} fps` : null
      const parts = [CODEC_NAMES[entry.codec] ?? entry.codec, PLACE(entry.hardware), size]
      return { label: 'Reserva', value: parts.filter(Boolean).join(' · ') }
    })
}

const WHERE = (hardware: boolean | null): string =>
  hardware === null ? '—' : hardware ? 'Na placa de vídeo' : 'No processador'

function leaving(info: ScreenEncoderInfo, entry: EncoderEntry): string {
  if (!entry.backup) return info.quality ?? '—'
  return entry.height && entry.fps !== null ? `${entry.height}p ${entry.fps} (reserva)` : '—'
}

/** `received`: o codec que eu estou recebendo ("H264"); a reserva tem o próprio codificador. */
export function remoteEncoderRows(info: ScreenEncoderInfo | null, received: string): StatRow[] {
  const entry = info?.encoders.find((encoder) => encoder.codec === received)
  return [
    { label: 'Codificado', value: entry ? WHERE(entry.hardware) : '—' },
    { label: 'Saindo em', value: info && entry ? leaving(info, entry) : '—' }
  ]
}
