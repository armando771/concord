import type { LocalParticipant } from 'livekit-client'
import { publishScreenTracks, updatePublishedScreenQuality } from './screenPublish'
import type { ScreenShareQuality } from './screenShareQuality'

// A minha live na sala: publicar e trocar a qualidade ao vivo, sem despublicar.
// O CallMedia delega para cá (o livekit.ts não cresce com a tela).

export class ScreenSender {
  constructor(
    private readonly participant: LocalParticipant,
    /** A sala continua conectada (senão a troca é abandonada). */
    private readonly connected: () => boolean
  ) {}

  publish(stream: MediaStream): Promise<void> {
    return publishScreenTracks(this.participant, stream)
  }

  /** Não despublica: preserva SID, tracks e assinaturas de quem já está assistindo. */
  update(stream: MediaStream, quality: ScreenShareQuality): Promise<void> {
    return updatePublishedScreenQuality(this.participant, stream, quality, this.connected)
  }
}
