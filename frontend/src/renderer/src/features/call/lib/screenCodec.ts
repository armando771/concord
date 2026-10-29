// Codec da live (vídeo da tela). Padrão: H.264, que no teste deixou texto
// rolando muito mais nítido com bem menos banda que o VP8 e pode usar o encoder
// de hardware; VP8 de reserva para quem não decodificar H.264. "VP8" em
// Avançado é a saída manual se der problema. Ver docs/adr/0015.

export type ScreenCodecPreference = 'auto' | 'vp8'

export const SCREEN_CODEC_KEY = 'salinha:screen-share-codec'

export interface ScreenCodecOptions {
  videoCodec: 'h264' | 'vp8'
  backupCodec: false | { codec: 'vp8' }
}

/** O navegador sabe codificar H.264 (Chromium/Electron sim; algumas builds não). */
export function canEncodeH264(
  capabilities: {
    codecs: { mimeType: string }[]
  } | null = globalThis.RTCRtpSender?.getCapabilities?.('video') ?? null
): boolean {
  return !!capabilities?.codecs.some((codec) => codec.mimeType.toLowerCase() === 'video/h264')
}

export function screenCodecOptions(
  preference: ScreenCodecPreference,
  h264: boolean
): ScreenCodecOptions {
  if (preference === 'auto' && h264) return { videoCodec: 'h264', backupCodec: { codec: 'vp8' } }
  return { videoCodec: 'vp8', backupCodec: false }
}

export function loadScreenCodec(): ScreenCodecPreference {
  try {
    return localStorage.getItem(SCREEN_CODEC_KEY) === 'vp8' ? 'vp8' : 'auto'
  } catch {
    return 'auto'
  }
}

export function saveScreenCodec(preference: ScreenCodecPreference): void {
  try {
    localStorage.setItem(SCREEN_CODEC_KEY, preference)
  } catch {
    /* Compartilhar continua funcionando sem armazenamento local. */
  }
}
