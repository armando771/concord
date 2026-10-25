import { streamAudioKey } from '../../store/userAudioStore'
import { isMaestroIdentity } from '../../lib/music'

// Quais <audio> remotos tocar e quais o ensurdecer cala: só as vozes da call.
// O som das transmissões continua (com o volume próprio do botão direito).

export interface RemoteAudioEntry {
  key: string
  stream: MediaStream
  muted: boolean
  /** Chave do volume/silenciar por pessoa (voz) ou por live (`screen:<id>`). */
  volumeKey: string
  /** Faixa do Maestro: recebe o volume que abaixa quando alguém fala. */
  music: boolean
}

export function remoteAudioEntries(input: {
  streams: Record<string, MediaStream>
  screenAudioStreams: Record<string, MediaStream>
  deafened: boolean
}): RemoteAudioEntry[] {
  const voices = Object.entries(input.streams).map(([userId, stream]) => ({
    key: userId,
    stream,
    muted: input.deafened,
    volumeKey: userId,
    music: isMaestroIdentity(userId)
  }))
  const screens = Object.entries(input.screenAudioStreams).map(([userId, stream]) => {
    const key = streamAudioKey(userId)
    return { key, stream, muted: false, volumeKey: key, music: false }
  })
  return [...voices, ...screens]
}
