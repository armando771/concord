// Qualidade da conexão de cada pessoa na chamada (sinal ConnectionQuality do
// LiveKit) e o texto do tooltip, com perda de pacotes e latência quando as
// estatísticas do WebRTC (getStats) trazem.

/** Valores do ConnectionQuality do livekit-client, mais 'unknown' (ainda sem medida). */
export type CallQuality = 'excellent' | 'good' | 'poor' | 'lost' | 'unknown'

/** De quanto em quanto tempo medir perda/latência de quem está com conexão ruim. */
export const QUALITY_STATS_INTERVAL_MS = 4000

export interface QualityDetails {
  /** Perda de pacotes recente, em % (null = sem medida). */
  lossPercent: number | null
  latencyMs: number | null
}

export function asCallQuality(value: unknown): CallQuality {
  return value === 'excellent' || value === 'good' || value === 'poor' || value === 'lost'
    ? value
    : 'unknown'
}

/** Barrinhas acesas (de 3). */
export function qualityBars(quality: CallQuality): number {
  switch (quality) {
    case 'excellent':
      return 3
    case 'good':
      return 2
    case 'poor':
      return 1
    default:
      return 0
  }
}

export function isPoorQuality(quality: CallQuality): boolean {
  return quality === 'poor' || quality === 'lost'
}

function detailsText(details: QualityDetails | undefined): string {
  if (!details) return ''
  const parts: string[] = []
  if (details.lossPercent !== null)
    parts.push(`perda de pacotes ${formatPercent(details.lossPercent)}`)
  if (details.latencyMs !== null) parts.push(`latência ${Math.round(details.latencyMs)} ms`)
  if (parts.length === 0) return ''
  const text = parts.join(' · ')
  return ` Agora: ${text[0].toUpperCase()}${text.slice(1)}.`
}

function formatPercent(value: number): string {
  if (value > 0 && value < 1) return '<1%'
  return `${Math.round(value)}%`
}

/** Tooltip das barrinhas. `name` = null para o próprio usuário. */
export function qualityTooltip(
  quality: CallQuality,
  name: string | null,
  details?: QualityDetails
): string {
  const self = name === null
  switch (quality) {
    case 'excellent':
      return self ? 'Sua conexão está excelente.' : `Conexão de ${name}: excelente.`
    case 'good':
      return self ? 'Sua conexão está boa.' : `Conexão de ${name}: boa.`
    case 'poor':
      return (
        (self
          ? 'Sua conexão está ruim: sua voz pode falhar ou chegar atrasada para os outros.'
          : `A conexão de ${name} está ruim: a voz pode falhar ou chegar atrasada.`) +
        detailsText(details)
      )
    case 'lost':
      return (
        (self
          ? 'Sua conexão caiu — tentando recuperar.'
          : `${name} perdeu a conexão — tentando recuperar.`) + detailsText(details)
      )
    case 'unknown':
      return 'Medindo a conexão…'
  }
}

/**
 * Perda (em %) que o servidor de voz relata sobre o que eu envio
 * (remote-inbound-rtp.fractionLost, já é a fração recente). Pega a pior.
 */
export function reportOutboundLoss(report: RTCStatsReport): number | null {
  let worst: number | null = null
  report.forEach((stat) => {
    if (stat.type !== 'remote-inbound-rtp') return
    const fraction = stat.fractionLost
    if (typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction < 0) return
    worst = Math.max(worst ?? 0, fraction * 100)
  })
  return worst
}

export interface PacketCounters {
  lost: number
  received: number
}

/** Pacotes recebidos e perdidos (acumulados) do áudio que chega de alguém. */
export function inboundCounters(report: RTCStatsReport): PacketCounters | null {
  let found = false
  let lost = 0
  let received = 0
  report.forEach((stat) => {
    if (stat.type !== 'inbound-rtp') return
    if (typeof stat.packetsReceived !== 'number') return
    found = true
    received += stat.packetsReceived
    lost += typeof stat.packetsLost === 'number' ? Math.max(0, stat.packetsLost) : 0
  })
  return found ? { lost, received } : null
}

/** Perda (em %) entre duas leituras dos contadores; null se não dá para dizer. */
export function lossBetween(previous: PacketCounters | null, next: PacketCounters): number | null {
  if (!previous) return null
  const lost = next.lost - previous.lost
  const received = next.received - previous.received
  // Contadores voltaram (track nova): não compara.
  if (lost < 0 || received < 0) return null
  const total = lost + received
  return total > 0 ? (lost / total) * 100 : null
}
