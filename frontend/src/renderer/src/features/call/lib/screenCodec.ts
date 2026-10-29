// Codec da live (vídeo da tela). Automático: AV1 se a placa de vídeo codifica
// AV1 (melhor imagem com a mesma banda, sem pesar a CPU), com H.264 de reserva
// para quem não decodifica AV1; senão H.264 (placa de vídeo ou OpenH264), com
// VP8 de reserva; VP8 só sem H.264. AV1 por software nunca (pesado demais).
// "H.264" e "VP8" em Avançado fixam o codec. Ver docs/adr/0015 e 0019.

export type ScreenCodecPreference = 'auto' | 'h264' | 'vp8'

export const SCREEN_CODEC_KEY = 'salinha:screen-share-codec'
/** Uma live em AV1 caiu no encoder por software: as próximas vão em H.264. */
const AV1_SOFTWARE_KEY = 'salinha:screen-av1-software'

export interface ScreenCodecOptions {
  videoCodec: 'av1' | 'h264' | 'vp8'
  backupCodec: false | { codec: 'h264' | 'vp8' }
}

export interface ScreenCodecSupport {
  /** A placa de vídeo codifica AV1 no modo que o LiveKit usa para tela. */
  av1Hardware: boolean
  /** O navegador codifica H.264 (placa de vídeo ou software). */
  h264: boolean
}

type SenderCapabilities = { codecs: { mimeType: string }[] } | null

const senderCapabilities = (): SenderCapabilities =>
  globalThis.RTCRtpSender?.getCapabilities?.('video') ?? null

const hasCodec = (capabilities: SenderCapabilities, mime: string): boolean =>
  !!capabilities?.codecs.some((codec) => codec.mimeType.toLowerCase() === mime)

/** O navegador sabe codificar H.264 (Chromium/Electron sim; algumas builds não). */
export function canEncodeH264(capabilities: SenderCapabilities = senderCapabilities()): boolean {
  return hasCodec(capabilities, 'video/h264')
}

interface EncodingInfoApi {
  encodingInfo(config: unknown): Promise<{ supported: boolean; powerEfficient: boolean }>
}

/**
 * A placa de vídeo codifica AV1 para WebRTC no tamanho da live? O LiveKit
 * publica tela em AV1 com L1T3, então a pergunta inclui o modo; powerEfficient
 * = hardware (o Chromium responde pelo encoder da GPU).
 */
export async function av1HardwareEncode(
  video: { width: number; height: number; bitrate: number; framerate: number },
  api: EncodingInfoApi | undefined = globalThis.navigator?.mediaCapabilities as
    | EncodingInfoApi
    | undefined,
  capabilities: SenderCapabilities = senderCapabilities()
): Promise<boolean> {
  if (readFlag(AV1_SOFTWARE_KEY) || !api || !hasCodec(capabilities, 'video/av1')) return false
  try {
    const info = await api.encodingInfo({
      type: 'webrtc',
      video: { contentType: 'video/AV1', scalabilityMode: 'L1T3', ...video }
    })
    return info.supported && info.powerEfficient
  } catch {
    return false
  }
}

const VP8_ONLY: ScreenCodecOptions = { videoCodec: 'vp8', backupCodec: false }

/** `simulcast`: com a camada extra de 720p vai H.264 (AV1 de tela é uma camada só no SDK). */
export function screenCodecOptions(
  preference: ScreenCodecPreference,
  support: ScreenCodecSupport,
  simulcast = false
): ScreenCodecOptions {
  if (preference === 'vp8' || !support.h264) return VP8_ONLY
  if (preference === 'auto' && support.av1Hardware && !simulcast)
    return { videoCodec: 'av1', backupCodec: { codec: 'h264' } }
  return { videoCodec: 'h264', backupCodec: { codec: 'vp8' } }
}

function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeFlag(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Compartilhar continua funcionando sem armazenamento local. */
  }
}

export function markAv1Software(): void {
  writeFlag(AV1_SOFTWARE_KEY, '1')
}

export function loadScreenCodec(): ScreenCodecPreference {
  const value = readFlag(SCREEN_CODEC_KEY)
  return value === 'vp8' || value === 'h264' ? value : 'auto'
}

export function saveScreenCodec(preference: ScreenCodecPreference): void {
  writeFlag(SCREEN_CODEC_KEY, preference)
}
