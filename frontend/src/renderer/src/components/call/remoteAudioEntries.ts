import { streamAudioKey } from '../../store/userAudioStore'

// Quais <audio> remotos tocar e quais o ensurdecer cala: só as vozes da call.
// O som das transmissões continua (com o volume próprio do botão direito).

export interface RemoteAudioEntry {
  key: string
  stream: MediaStream
  muted: boolean
  /** Chave do volume/silenciar por pessoa (voz) ou por live (`screen:<id>`). */
  volumeKey: string
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
    volumeKey: userId
  }))
  const screens = Object.entries(input.screenAudioStreams).map(([userId, stream]) => {
    const key = streamAudioKey(userId)
    return { key, stream, muted: false, volumeKey: key }
  })
  return [...voices, ...screens]
}
