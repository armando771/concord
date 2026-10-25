// Pedido do getDisplayMedia (compartilhar tela). Puro para poder testar.

/** Som da captura: sem o processamento de voz, e sem o som da própria Salinha. */
const SCREEN_AUDIO = {
  // Tira o áudio da própria Salinha (vozes da chamada) do loopback, evitando
  // eco para quem assiste.
  restrictOwnAudio: true,
  suppressLocalAudioPlayback: false,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false
} as MediaTrackConstraints

/**
 * Desktop: o Electron resolve a fonte pelo modal do app (ScreenSharePickerModal).
 * Navegador: o seletor é o do próprio navegador — pede o som do sistema (Chrome
 * no Windows/ChromeOS) ou da aba, e tira a aba da Salinha da lista.
 */
export function displayMediaOptions(
  web: boolean,
  { audio = true }: { audio?: boolean } = {}
): DisplayMediaStreamOptions {
  const base: DisplayMediaStreamOptions = {
    video: { frameRate: 30 },
    audio: audio ? SCREEN_AUDIO : false
  }
  if (!web || !audio) return base
  return {
    ...base,
    systemAudio: 'include',
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include'
  } as DisplayMediaStreamOptions
}

/**
 * Navegador que não captura som de tela (ex.: Safari) pode recusar o pedido
 * com áudio: aí vale tentar de novo só com o vídeo. Cancelar não repete.
 */
export function retryWithoutAudio(err: unknown): boolean {
  if (err instanceof TypeError) return true
  return (err as DOMException | undefined)?.name === 'NotSupportedError'
}
