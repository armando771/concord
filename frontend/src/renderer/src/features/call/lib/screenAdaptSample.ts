// Uma leitura do envio da live para o controlador de qualidade: está limitado
// (e por quê)? Puro: recebe o getStats() do envio e o bitrate do degrau atual.

export type Limitation = 'cpu' | 'bandwidth'

/** Codecs cuja queda para o processador fica marcada no aparelho (AV1/H.265 só valem na placa; H.264 decide a camada extra de 720p). */
export type MarkedCodec = 'av1' | 'h265' | 'h264'

export interface AdaptSample {
  limited: Limitation | null
  /** Live caiu no encoder por software: AV1/H.265 não se usam de novo; H.264 deixa de ligar a camada extra de 720p sozinha. */
  softwareCodec: MarkedCodec | null
}

type Stat = Record<string, unknown>

const num = (value: unknown): number | null => (typeof value === 'number' ? value : null)

/** Fonte mandando quadros de verdade (tela parada manda poucos e não conta). */
const MIN_SOURCE_FPS = 10
/** Saindo menos que isso dos quadros da fonte = soltando quadros. */
const FPS_RATIO = 0.7
/** Banda estimada abaixo disso do bitrate do degrau = falta banda. */
const TARGET_RATIO = 0.5
/** Soltando quadros com o alvo abaixo disso = banda; acima = CPU. */
const BANDWIDTH_DROP_RATIO = 0.8

function activeVideo(report: RTCStatsReport): Stat | null {
  let best: Stat | null = null
  report.forEach((stat: Stat) => {
    if (stat.type !== 'outbound-rtp' || stat.kind !== 'video' || stat.active === false) return
    if (!best || (num(stat.bytesSent) ?? 0) > (num(best.bytesSent) ?? 0)) best = stat
  })
  return best
}

function droppingFrames(out: Stat, source: Stat | undefined): boolean {
  const sourceFps = num(source?.framesPerSecond) ?? 0
  const sentFps = num(out.framesPerSecond) ?? 0
  return sourceFps >= MIN_SOURCE_FPS && sentFps < sourceFps * FPS_RATIO
}

function limitation(out: Stat, source: Stat | undefined, budget: number): Limitation | null {
  const reason = out.qualityLimitationReason
  if (reason === 'cpu' || reason === 'bandwidth') return reason
  const target = num(out.targetBitrate) ?? budget
  if (target < budget * TARGET_RATIO) return 'bandwidth'
  if (!droppingFrames(out, source)) return null
  return target < budget * BANDWIDTH_DROP_RATIO ? 'bandwidth' : 'cpu'
}

const MARKED: Record<string, MarkedCodec> = {
  'video/av1': 'av1',
  'video/h265': 'h265',
  'video/h264': 'h264'
}

function softwareCodec(report: RTCStatsReport, out: Stat): MarkedCodec | null {
  const codec = report.get(out.codecId as string) as Stat | undefined
  const marked = MARKED[String(codec?.mimeType).toLowerCase()]
  if (!marked) return null
  if (out.powerEfficientEncoder === false) return marked
  // H.264 só pela flag: o nome do encoder muda com o adaptador de simulcast.
  if (marked === 'h264') return null
  return /libaom|software|fallback/i.test(String(out.encoderImplementation ?? '')) ? marked : null
}

/** null = envio pausado (ninguém vendo) ou ainda sem envio: não conta. */
export function adaptSample(report: RTCStatsReport, budgetBps: number): AdaptSample | null {
  const out = activeVideo(report)
  if (!out) return null
  const source = report.get(out.mediaSourceId as string) as Stat | undefined
  return { limited: limitation(out, source, budgetBps), softwareCodec: softwareCodec(report, out) }
}
