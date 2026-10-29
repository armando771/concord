import { VideoPreset } from 'livekit-client'
import { captureSize, screenEncoding, type ScreenShareQuality } from './screenShareQuality'

// Camada extra de 720p (opcional, desmarcada por padrão): como as "renditions"
// da Twitch, quem tem internet fraca (ou vê a live pequena) recebe 720p em vez
// de congelar. Custa um segundo encode no PC de quem transmite. Ver docs/adr/0020.

export const SIMULCAST_KEY = 'salinha:screen-share-720p-extra'

/** A camada de baixo: 720p30 a 3 Mbps (preset de 720p30 da Twitch). */
const LOW = { height: 720, maxBitrate: 3_000_000, maxFramerate: 30 }

export function loadScreenSimulcast(): boolean {
  try {
    return localStorage.getItem(SIMULCAST_KEY) === '1'
  } catch {
    return false
  }
}

export function saveScreenSimulcast(on: boolean): void {
  try {
    localStorage.setItem(SIMULCAST_KEY, on ? '1' : '0')
  } catch {
    /* Compartilhar continua funcionando sem armazenamento local. */
  }
}

/** Só faz sentido acima de 720p (abaixo seriam duas camadas iguais). */
export function usesSimulcast(
  on: boolean,
  quality: ScreenShareQuality,
  source: MediaTrackSettings
): boolean {
  return on && captureSize(quality.resolution, source).height > LOW.height
}

/** Camadas para o publishTrack do LiveKit (ele monta a de cima com o screenShareEncoding). */
export function simulcastLayers(): VideoPreset[] {
  return [new VideoPreset(1280, 720, LOW.maxBitrate, LOW.maxFramerate)]
}

/**
 * Encodings do sender para um degrau, na ordem do LiveKit (de baixo para
 * cima). `count`: quantas camadas a publicação tem (1 ou 2).
 */
export function screenSenderEncodings(
  quality: ScreenShareQuality,
  source: MediaTrackSettings,
  count: number
): RTCRtpEncodingParameters[] {
  const top = screenEncoding(quality, source)
  if (count < 2) return [top]
  const size = captureSize(quality.resolution, source)
  const scaleResolutionDownBy = Math.max(1, Math.min(size.width, size.height) / LOW.height)
  return [{ maxBitrate: LOW.maxBitrate, maxFramerate: LOW.maxFramerate, scaleResolutionDownBy }, top]
}
