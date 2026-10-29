// Uma leitura do envio da live para o controlador de qualidade: está limitado
// (e por quê)? Puro: recebe o getStats() do envio e o bitrate do degrau atual.

export type Limitation = 'cpu' | 'bandwidth'

/** Codecs que só valem na placa de vídeo. */
export type HardwareOnlyCodec = 'av1' | 'h265'

export interface AdaptSample {
  limited: Limitation | null
  /** Live em AV1/H.265 caiu no encoder por software (pesado): não usar esse codec de novo. */
  softwareCodec: HardwareOnlyCodec | null
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

const HARDWARE_ONLY: Record<string, HardwareOnlyCodec> = {
  'video/av1': 'av1',
  'video/h265': 'h265'
}

function softwareCodec(report: RTCStatsReport, out: Stat): HardwareOnlyCodec | null {
  const codec = report.get(out.codecId as string) as Stat | undefined
  const hardwareOnly = HARDWARE_ONLY[String(codec?.mimeType).toLowerCase()]
  if (!hardwareOnly) return null
  if (out.powerEfficientEncoder === false) return hardwareOnly
  return /libaom|software|fallback/i.test(String(out.encoderImplementation ?? ''))
    ? hardwareOnly
    : null
}

/** null = envio pausado (ninguém vendo) ou ainda sem envio: não conta. */
export function adaptSample(report: RTCStatsReport, budgetBps: number): AdaptSample | null {
  const out = activeVideo(report)
  if (!out) return null
  const source = report.get(out.mediaSourceId as string) as Stat | undefined
  return { limited: limitation(out, source, budgetBps), softwareCodec: softwareCodec(report, out) }
}
