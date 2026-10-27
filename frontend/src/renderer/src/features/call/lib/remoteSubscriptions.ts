import { useWindowActivityStore } from '../../../shared/store/windowActivityStore'
import { wantsSubscription, type TrackSourceName } from './callMedia'
import { pruneWatched } from './screenWatch'

// O que baixar de cada pessoa na chamada: voz e câmera sempre, tela (e o som
// dela) só de quem estou assistindo. Com a janela fora da tela (minimizada ou na
// bandeja) o vídeo fica pausado no servidor: ninguém está vendo, e decodificar e
// desenhar uma live a 30-60 qps custa CPU e GPU que o jogo precisa. O som segue.

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
  private videoPaused = false

  setWatched(userIds: string[]): void {
    this.watched = new Set(userIds)
  }

  /** Quem parou de transmitir sai dos assistidos (se voltar, começa pausada). */
  prune(availableScreens: string[]): void {
    this.watched = new Set(pruneWatched([...this.watched], availableScreens))
  }

  /** true se mudou (quem chama reaplica). */
  setVideoPaused(paused: boolean): boolean {
    if (this.videoPaused === paused) return false
    this.videoPaused = paused
    return true
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
        if (want && publication.kind === 'video') publication.setEnabled(!this.videoPaused)
      }
    }
  }
}

/** Chama `onChange(oculta)` já e a cada vez que a janela some ou volta; devolve o unsubscribe. */
export function watchHiddenWindow(onChange: (hidden: boolean) => void): () => void {
  const hidden = (): boolean => !useWindowActivityStore.getState().activity.visible
  let last = hidden()
  onChange(last)
  return useWindowActivityStore.subscribe(() => {
    if (hidden() === last) return
    last = hidden()
    onChange(last)
  })
}
