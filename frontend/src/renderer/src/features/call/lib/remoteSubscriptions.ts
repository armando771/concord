import { wantsSubscription, type TrackSourceName } from './callMedia'
import { pruneWatched } from './screenWatch'
import { videoEnabled, type VideoPauseState } from './screenVideoPause'

// O que baixar de cada pessoa na chamada: voz e câmera sempre, tela (e o som
// dela) só de quem estou assistindo. Com a janela fora da tela (minimizada ou na
// bandeja), ou a live fora da área visível do app, o vídeo fica pausado no
// servidor: ninguém está vendo, e decodificar e desenhar uma live a 30-60 qps
// custa CPU e GPU que o jogo precisa. O som segue (ver screenVideoPause.ts).

export interface RemotePublicationLike {
  source: string
  kind: string
  readonly isDesired: boolean
  setSubscribed(subscribed: boolean): void
  setEnabled(enabled: boolean): void
}

export interface RemoteParticipantLike {
  identity: string
  trackPublications: Map<string, RemotePublicationLike>
}

export class RemoteSubscriptions {
  private watched = new Set<string>()
  private pause: VideoPauseState = { windowHidden: false, offscreen: new Set() }

  setWatched(userIds: string[]): void {
    this.watched = new Set(userIds)
  }

  /** Quem parou de transmitir sai dos assistidos (se voltar, começa pausada). */
  prune(availableScreens: string[]): void {
    this.watched = new Set(pruneWatched([...this.watched], availableScreens))
  }

  /** true se mudou (quem chama reaplica). */
  setPause(pause: VideoPauseState): boolean {
    const same =
      this.pause.windowHidden === pause.windowHidden &&
      this.pause.offscreen.size === pause.offscreen.size &&
      [...pause.offscreen].every((id) => this.pause.offscreen.has(id))
    this.pause = pause
    return !same
  }

  apply(participants: Iterable<RemoteParticipantLike>): void {
    for (const participant of participants) {
      for (const publication of participant.trackPublications.values()) {
        const want = wantsSubscription(
          publication.source as TrackSourceName,
          participant.identity,
          this.watched
        )
        // Com autoSubscribe desligado, isDesired começa false.
        if (publication.isDesired !== want) publication.setSubscribed(want)
        // O SDK só aceita pausar o que está assinado; repetir o mesmo valor é no-op.
        if (want && publication.kind === 'video') {
          publication.setEnabled(videoEnabled(publication.source, participant.identity, this.pause))
        }
      }
    }
  }
}
