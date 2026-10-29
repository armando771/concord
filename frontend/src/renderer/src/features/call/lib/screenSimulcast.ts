import { VideoPreset } from 'livekit-client'
import { captureSize, screenEncoding, type ScreenShareQuality } from './screenShareQuality'
import { screenCodecOptions, type ScreenCodecPreference } from './screenCodec'
import type { ScreenCodecSupport } from './screenCodecSupport'

// Camada extra de 720p, como as "renditions" da Twitch: quem tem internet fraca
// (ou vê a live pequena) recebe 720p em vez de congelar. Custa um segundo encode
// no PC de quem transmite, então no Automático (padrão) só liga quando o codec
// da live é codificado pela placa de vídeo. Ligada/Desligada forçam. Ver docs/adr/0020.

export const SIMULCAST_KEY = 'salinha:screen-share-720p-extra'

export type SimulcastMode = 'auto' | 'on' | 'off'

/** A camada de baixo: 720p30 a 3 Mbps (preset de 720p30 da Twitch). */
const LOW = { height: 720, maxBitrate: 3_000_000, maxFramerate: 30 }

const STORED: Record<SimulcastMode, string> = { auto: 'auto', on: '1', off: '0' }

export function loadScreenSimulcast(): SimulcastMode {
  try {
    const value = localStorage.getItem(SIMULCAST_KEY)
    return value === STORED.on ? 'on' : value === STORED.off ? 'off' : 'auto'
  } catch {
    return 'auto'
  }
}

export function saveScreenSimulcast(mode: SimulcastMode): void {
  try {
    localStorage.setItem(SIMULCAST_KEY, STORED[mode])
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

/**
 * Publica a camada extra? Ligada/Desligada valem sempre (a de 720p só com
 * captura acima de 720p). Automático: só se o codec que a live vai usar sai
 * pela placa de vídeo. Com AV1 não liga (o SDK publica AV1 de tela numa camada
 * só): fica o AV1, que já é o melhor codec da placa.
 */
export function chooseScreenSimulcast(
  mode: SimulcastMode,
  quality: ScreenShareQuality,
  source: MediaTrackSettings,
  support: ScreenCodecSupport,
  preference: ScreenCodecPreference
): boolean {
  if (mode === 'off' || !usesSimulcast(true, quality, source)) return false
  if (mode === 'on') return true
  const { videoCodec } = screenCodecOptions(preference, support)
  return videoCodec !== 'av1' && support[videoCodec] === 'hardware'
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
