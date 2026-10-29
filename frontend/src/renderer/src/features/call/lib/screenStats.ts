import type { ScreenAdaptView } from '../store/screenAdaptStore'

// Estatísticas da live (painel no canto do vídeo): transforma o getStats() do
// envio (quem transmite) ou da recepção (quem assiste) em linhas prontas para a
// UI. Puro: quem lê o RTCStatsReport e guarda a leitura anterior é o hook.

/** Entrada de uma leitura: o relatório e o estado da publicação no SDK. */
export interface ScreenStatsInput {
  /** A própria transmissão (envio) ou a de outra pessoa (recepção). */
  local: boolean
  report: RTCStatsReport
  /** Recepção: false = vídeo desligado por mim (janela oculta, fora de vista). */
  enabled: boolean
  /** Recepção: 'paused' = o servidor parou de mandar (conexão fraca). */
  streamState: string
  /** Envio: fps pedido na qualidade da transmissão. */
  requestedFps: number | null
  /** Envio: degrau saindo agora (o controlador pode ter descido). */
  quality?: ScreenAdaptView | null
}

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

export interface ScreenStatsView {
  rows: StatRow[]
  /** Aviso no topo do painel (pausada, sem dados) ou null. */
  status: string | null
}

export type LivePauseReason = 'offscreen' | 'connection'

type Stat = Record<string, unknown>

const IDLE_TEXT = 'Envio pausado: ninguém está vendo a live agora'

const PAUSE_TEXT: Record<LivePauseReason, string> = {
  offscreen: 'Vídeo pausado (fora de vista)',
  connection: 'Pausada pela sua conexão'
}

const LIMITATION: Record<string, string> = {
  none: 'Nenhuma',
  cpu: 'CPU',
  bandwidth: 'Banda',
  other: 'Outra'
}

const HARDWARE =
  /accelerator|mediafoundation|vaapi|videotoolbox|nvenc|nvdec|d3d11|dxva|external|v4l2|mediacodec/i
const SOFTWARE = /fallback|libvpx|openh264|ffmpeg|libaom|dav1d|software/i

const num = (value: unknown): number | null => (typeof value === 'number' ? value : null)
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

const decimal = (value: number, digits = 1): string =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: digits })

export function limitationLabel(reason: string | undefined): string {
  return (reason && LIMITATION[reason]) || '—'
}

/** Desligado por mim (fora de vista) vem antes da pausa do servidor. */
export function livePauseReason(enabled: boolean, streamState: string): LivePauseReason | null {
  if (!enabled) return 'offscreen'
  return streamState === 'paused' ? 'connection' : null
}

function implementationKind(name: string, powerEfficient: boolean | undefined): string | null {
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

/** "H.265 · placa de vídeo": o codec em uso e onde ele roda (quando o navegador conta). */
function codecName(report: RTCStatsReport, stat: Stat, implementation: string): string {
  const codec =
    typeof stat.codecId === 'string' ? (report.get(stat.codecId) as Stat | undefined) : undefined
  const mime = text(codec?.mimeType)
  if (!mime) return '—'
  const name = mime.slice(mime.indexOf('/') + 1).toUpperCase()
  const where = WHERE[implementation.split(' · ')[0]]
  return `${CODEC_NAMES[name] ?? name}${where ? ` · ${where}` : ''}`
}

/**
 * O RTP de vídeo que está mandando/recebendo (com codec de reserva, o ativo que
 * mais trafegou). Nenhum ativo: o pausado (o dynacast pausa o envio quando
 * ninguém está vendo a live), para o painel dizer isso em vez de "sem dados".
 */
function videoRtp(report: RTCStatsReport, type: string, bytesKey: string): Stat | null {
  let best: Stat | null = null
  let idle: Stat | null = null
  report.forEach((stat: Stat) => {
    if (stat.type !== type || stat.kind !== 'video') return
    if (stat.active === false) idle ??= stat
    else if (!best || (num(stat[bytesKey]) ?? 0) > (num(best[bytesKey]) ?? 0)) best = stat
  })
  return best ?? idle
}

function sampleOf(stat: Stat, bytesKey: string, framesKey: string): ScreenStatsSample {
  return {
    timestamp: num(stat.timestamp) ?? 0,
    bytes: num(stat[bytesKey]) ?? 0,
    frames: num(stat[framesKey]) ?? 0,
    qpSum: num(stat.qpSum),
    packetsReceived: num(stat.packetsReceived) ?? 0,
    packetsLost: num(stat.packetsLost) ?? 0
  }
}

function bitrate(now: ScreenStatsSample, prev: ScreenStatsSample | null): string {
  const seconds = prev ? (now.timestamp - prev.timestamp) / 1000 : 0
  if (!prev || seconds <= 0) return '—'
  const mbps = ((now.bytes - prev.bytes) * 8) / seconds / 1_000_000
  return mbps < 0.05 ? '< 0,1 Mbps' : `${decimal(mbps)} Mbps`
}

function resolution(stat: Stat): string {
  const width = num(stat.frameWidth)
  const height = num(stat.frameHeight)
  return width && height ? `${width}×${height}` : '—'
}

function fps(stat: Stat): string {
  if (stat.active === false) return '0'
  const value = num(stat.framesPerSecond)
  return value === null ? '—' : String(Math.round(value))
}

function averageQp(now: ScreenStatsSample, prev: ScreenStatsSample | null): StatRow[] {
  if (now.qpSum === null || !prev || prev.qpSum === null || now.frames <= prev.frames) return []
  return [
    {
      label: 'QP médio',
      value: String(Math.round((now.qpSum - prev.qpSum) / (now.frames - prev.frames)))
    }
  ]
}

const REDUCED_BY: Record<string, string> = { cpu: 'pelo PC', bandwidth: 'pela conexão' }

/** "720p 60 (de 1080p 60, pela conexão)": o degrau saindo e por que desceu. */
function qualityRows(view: ScreenAdaptView | null | undefined): StatRow[] {
  if (!view) return []
  const why = view.reason ? `, ${REDUCED_BY[view.reason]}` : ''
  const value = view.reduced ? `${view.effective} (de ${view.chosen}${why})` : view.effective
  return [{ label: 'Qualidade', value }]
}

function senderRows(
  input: ScreenStatsInput,
  stat: Stat,
  now: ScreenStatsSample,
  prev: ScreenStatsSample | null
): StatRow[] {
  const requested = input.requestedFps === null ? '' : ` de ${input.requestedFps}`
  const encoder = codecImplementation(
    text(stat.encoderImplementation),
    stat.powerEfficientEncoder as boolean | undefined
  )
  return [
    ...qualityRows(input.quality),
    { label: 'Quadros', value: `${fps(stat)}${requested} fps` },
    { label: 'Resolução', value: resolution(stat) },
    { label: 'Taxa', value: bitrate(now, prev) },
    { label: 'Codec', value: codecName(input.report, stat, encoder) },
    { label: 'Codificador', value: encoder },
    { label: 'Limitação', value: limitationLabel(text(stat.qualityLimitationReason)) },
    ...averageQp(now, prev)
  ]
}

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

function receiverRows(
  input: ScreenStatsInput,
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
    { label: 'Codec', value: codecName(input.report, stat, decoder) },
    { label: 'Decodificador', value: decoder },
    { label: 'Perda', value: lossPercent(now, prev) },
    { label: 'Jitter', value: jitter === null ? '—' : `${Math.round(jitter * 1000)} ms` },
    { label: 'Descartados', value: String(num(stat.framesDropped) ?? '—') },
    { label: 'Congelamentos', value: freezes(stat) }
  ]
}

/** Linhas do painel + a leitura que a próxima chamada recebe como `prev`. */
export function screenStatsView(
  input: ScreenStatsInput,
  prev: ScreenStatsSample | null
): { view: ScreenStatsView; sample: ScreenStatsSample | null } {
  const [type, bytesKey, framesKey] = input.local
    ? ['outbound-rtp', 'bytesSent', 'framesEncoded']
    : ['inbound-rtp', 'bytesReceived', 'framesDecoded']
  const stat = videoRtp(input.report, type, bytesKey)
  const pause = input.local ? null : livePauseReason(input.enabled, input.streamState)
  const pauseText = pause ? PAUSE_TEXT[pause] : stat?.active === false ? IDLE_TEXT : null
  if (!stat) return { view: { rows: [], status: pauseText ?? 'Ainda sem dados' }, sample: null }
  const now = sampleOf(stat, bytesKey, framesKey)
  const rows = input.local
    ? senderRows(input, stat, now, prev)
    : receiverRows(input, stat, now, prev)
  return { view: { rows, status: pauseText }, sample: now }
}
