export interface DisplaySource {
  id: string
  name: string
}

export interface DisplayMediaStreams<S extends DisplaySource> {
  video: S
  audio?: 'loopback'
}

/**
 * Resposta do setDisplayMediaRequestHandler para a fonte escolhida. O som da
 * tela é o loopback do sistema (só existe no Windows); como o renderer pede
 * `restrictOwnAudio`, o Electron (≥ 43.4) troca por loopbackWithoutChrome e o
 * áudio do próprio Concord — as vozes da chamada — fica de fora.
 */
export function displayMediaStreams<S extends DisplaySource>(
  source: S,
  audioRequested: boolean,
  platform: NodeJS.Platform
): DisplayMediaStreams<S> {
  if (audioRequested && platform === 'win32') return { video: source, audio: 'loopback' }
  return { video: source }
}
