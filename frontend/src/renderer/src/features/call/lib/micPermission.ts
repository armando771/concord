// A permissão de falar muda no meio da chamada (cargo novo, moderador que
// silencia ou libera). Perdê-la fecha o microfone no servidor: o app mostra
// "mudo". Quem ficou mudo só por isso volta a falar quando a permissão volta;
// quem já estava mudo por escolha continua mudo.

export interface MicPermissionDeps {
  muted: () => boolean
  deafened: () => boolean
  /** Atualiza o que o store guarda (canSpeak, canStream, muted, mutedBeforeDeafen). */
  patch: (partial: {
    canSpeak?: boolean
    canStream?: boolean
    muted?: boolean
    mutedBeforeDeafen?: boolean
  }) => void
  /** Aplica o mute no microfone e avisa a chamada. */
  commitMute: (muted: boolean) => void
  /** Publica o microfone se ainda não está publicado. */
  ensureMic: (muted: boolean) => void
}

export interface PublishAllowed {
  microphone: boolean
  stream: boolean
}

export function createMicPermission(deps: MicPermissionDeps): {
  sync: (allowed: PublishAllowed) => void
  reset: () => void
} {
  let mutedByPermission = false

  const reopen = (): void => {
    if (!deps.muted()) return
    // Ensurdecido nesse meio-tempo: ao voltar a ouvir, o microfone abre.
    if (deps.deafened()) {
      deps.patch({ mutedBeforeDeafen: false })
      return
    }
    deps.patch({ muted: false })
    deps.commitMute(false)
  }

  const sync = (allowed: PublishAllowed): void => {
    deps.patch({ canSpeak: allowed.microphone, canStream: allowed.stream })
    if (!allowed.microphone) {
      if (deps.muted()) return
      mutedByPermission = true
      deps.patch({ muted: true })
      deps.commitMute(true)
      return
    }
    if (mutedByPermission) reopen()
    mutedByPermission = false
    deps.ensureMic(deps.muted())
  }

  return {
    sync,
    reset: () => {
      mutedByPermission = false
    }
  }
}
