// Peças comuns das estatísticas da live (envio e recepção): ler campos do
// getStats() e formatar números, codec e onde ele roda. Puro.

/** O que a próxima leitura precisa para calcular taxas no intervalo. */
export interface ScreenStatsSample {
  timestamp: number
  bytes: number
  frames: number
  qpSum: number | null
  packetsReceived: number
  packetsLost: number
}

export interface StatRow {
  label: string
  value: string
}

export type Stat = Record<string, unknown>

const HARDWARE =
  /accelerator|mediafoundation|vaapi|videotoolbox|nvenc|nvdec|d3d11|dxva|external|v4l2|mediacodec/i
const SOFTWARE = /fallback|libvpx|openh264|ffmpeg|libaom|dav1d|software/i

export const num = (value: unknown): number | null => (typeof value === 'number' ? value : null)
export const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

export const decimal = (value: number, digits = 1): string =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: digits })

/** 'Hardware' | 'Software' | null (o navegador não conta). */
export function implementationKind(
  name: string,
  powerEfficient: boolean | undefined
): string | null {
  if (powerEfficient !== undefined) return powerEfficient ? 'Hardware' : 'Software'
  if (SOFTWARE.test(name)) return 'Software'
  return HARDWARE.test(name) ? 'Hardware' : null
}

/** "Hardware · MediaFoundationVideoEncodeAccelerator"; o navegador nem sempre conta. */
export function codecImplementation(
  name: string | undefined,
  powerEfficient: boolean | undefined
): string {
  if (!name) return '—'
  const kind = implementationKind(name, powerEfficient)
  return kind ? `${kind} · ${name}` : name
}

const CODEC_NAMES: Record<string, string> = { H264: 'H.264', H265: 'H.265' }
const WHERE: Record<string, string> = { Hardware: 'placa de vídeo', Software: 'processador' }

/** "H265": o subtipo do mimeType do codec desse RTP, em maiúsculas. */
export function codecSubtype(report: RTCStatsReport, stat: Stat): string | null {
  const codec =
    typeof stat.codecId === 'string' ? (report.get(stat.codecId) as Stat | undefined) : undefined
  const mime = text(codec?.mimeType)
  return mime ? mime.slice(mime.indexOf('/') + 1).toUpperCase() : null
}

/** "H.265 · placa de vídeo": o codec em uso e onde ele roda (quando o navegador conta). */
export function codecName(report: RTCStatsReport, stat: Stat, implementation: string): string {
  const name = codecSubtype(report, stat)
  if (!name) return '—'
  const where = WHERE[implementation.split(' · ')[0]]
  return `${CODEC_NAMES[name] ?? name}${where ? ` · ${where}` : ''}`
}

export function bitrate(now: ScreenStatsSample, prev: ScreenStatsSample | null): string {
  const seconds = prev ? (now.timestamp - prev.timestamp) / 1000 : 0
  if (!prev || seconds <= 0) return '—'
  const mbps = ((now.bytes - prev.bytes) * 8) / seconds / 1_000_000
  return mbps < 0.05 ? '< 0,1 Mbps' : `${decimal(mbps)} Mbps`
}

export function resolution(stat: Stat): string {
  const width = num(stat.frameWidth)
  const height = num(stat.frameHeight)
  return width && height ? `${width}×${height}` : '—'
}

export function fps(stat: Stat): string {
  if (stat.active === false) return '0'
  const value = num(stat.framesPerSecond)
  return value === null ? '—' : String(Math.round(value))
}

const count = (value: unknown): string => {
  const n = num(value)
  return n === null ? '—' : String(n)
}

/**
 * Quadros-chave e pedidos de quadro-chave (PLI + FIR) e retransmissões
 * (NACK): para cruzar com os congelamentos (cada pedido custa um quadro
 * grande; muitos seguidos = vídeo travando à espera dele).
 */
export function recoveryRows(stat: Stat, keyFramesKey: string): StatRow[] {
  const pli = num(stat.pliCount)
  const requests = pli === null ? null : pli + (num(stat.firCount) ?? 0)
  const keyFrames = num(stat[keyFramesKey])
  const value =
    keyFrames === null && requests === null ? '—' : `${count(keyFrames)} / ${count(requests)}`
  return [
    { label: 'Quadros-chave/PLI', value },
    { label: 'NACK', value: count(stat.nackCount) }
  ]
}
