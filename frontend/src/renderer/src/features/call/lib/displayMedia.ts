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
  { audio = true, frameRate = 30 }: { audio?: boolean; frameRate?: 30 | 60 } = {}
): DisplayMediaStreamOptions {
  const base: DisplayMediaStreamOptions = {
    video: { frameRate },
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

/**
 * O seletor de fonte é o do sistema (navegador, ou o xdg-desktop-portal no
 * Linux/Wayland): a qualidade é escolhida antes, num modal do app.
 */
export function usesNativePicker(web: boolean, flow: 'app' | 'portal' | undefined): boolean {
  return web || flow === 'portal'
}

/** Falta algo no sistema para compartilhar; a mensagem diz o que fazer. */
export class ScreenShareSetupError extends Error {
  override name = 'ScreenShareSetupError'
}

/**
 * Fechar o seletor do portal chega como AbortError (o Electron recusa o
 * pedido): é cancelamento, não falha — vira NotAllowedError, sem aviso.
 */
export function portalPickerError(err: unknown): unknown {
  if ((err as DOMException | undefined)?.name !== 'AbortError') return err
  return new DOMException('Compartilhamento de tela cancelado', 'NotAllowedError')
}
