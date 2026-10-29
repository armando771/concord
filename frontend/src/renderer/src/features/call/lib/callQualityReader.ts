import { ConnectionState, Track, type Room } from 'livekit-client'
import { reportLatency } from './connectionStats'
import {
  inboundCounters,
  lossBetween,
  reportOutboundLoss,
  type PacketCounters,
  type QualityDetails
} from './connectionQuality'

// Latência e perda de pacotes da chamada, lidas do getStats() das tracks (para
// o tooltip de conexão ruim). Separado do CallMedia, que só delega.

export class CallQualityReader {
  /** Última leitura dos pacotes recebidos de cada pessoa (perda entre leituras). */
  private inbound = new Map<string, PacketCounters>()

  constructor(
    private readonly room: Room,
    private readonly closing: () => boolean
  ) {}

  private live(): boolean {
    return !this.closing() && this.room.state === ConnectionState.Connected
  }

  /** RTT até o SFU pelas estatísticas públicas das tracks, inclusive em modo ouvinte. */
  async latency(): Promise<number | null> {
    if (!this.live()) return null
    const publications = [
      ...this.room.localParticipant.trackPublications.values(),
      ...Array.from(this.room.remoteParticipants.values()).flatMap((participant) =>
        Array.from(participant.trackPublications.values())
      )
    ]
    for (const publication of publications) {
      if (!publication.track) continue
      try {
        const report = await publication.track.getRTCStatsReport()
        if (!this.live()) return null
        const ms = report ? reportLatency(report) : null
        if (ms !== null) return ms
      } catch {
        // Track removida durante a consulta: tenta outra, sem interferir na chamada.
      }
    }
    return null
  }

  /**
   * `selfId`: eu (perda do que envio + latência até o servidor); os demais:
   * perda do áudio deles que chega até mim, desde a leitura anterior.
   */
  async details(userIds: string[], selfId: string | null): Promise<Record<string, QualityDetails>> {
    const out: Record<string, QualityDetails> = {}
    if (!this.live()) return out
    for (const userId of userIds) {
      try {
        out[userId] = userId === selfId ? await this.selfDetails() : await this.remoteDetails(userId)
      } catch {
        // Track trocada no meio da leitura: fica sem número desta vez.
      }
      if (this.closing()) return {}
    }
    return out
  }

  private async selfDetails(): Promise<QualityDetails> {
    const mic = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)
    const report = await mic?.track?.getRTCStatsReport()
    return {
      lossPercent: report ? reportOutboundLoss(report) : null,
      latencyMs: await this.latency()
    }
  }

  private async remoteDetails(userId: string): Promise<QualityDetails> {
    const participant = this.room.remoteParticipants.get(userId)
    const mic = participant?.getTrackPublication(Track.Source.Microphone)
    const report = await mic?.track?.getRTCStatsReport()
    const counters = report ? inboundCounters(report) : null
    if (!counters) {
      this.inbound.delete(userId)
      return { lossPercent: null, latencyMs: null }
    }
    const lossPercent = lossBetween(this.inbound.get(userId) ?? null, counters)
    this.inbound.set(userId, counters)
    return { lossPercent, latencyMs: null }
  }
}
