// O que a máquina de quem transmite codifica para a live, codec a codec, e
// onde: na placa de vídeo ('hardware'), no processador ('software') ou não
// codifica (null). Pergunta ao Chromium no tamanho da live e guarda a resposta
// na sessão. Ver docs/adr/0020-qualidade-das-lives.md.

export type ScreenVideoCodec = 'av1' | 'h265' | 'h264' | 'vp8'
export type CodecEncoder = 'hardware' | 'software' | null
export type ScreenCodecSupport = Record<ScreenVideoCodec, CodecEncoder>

export interface ScreenVideoShape {
  width: number
  height: number
  bitrate: number
  framerate: number
}

type SenderCapabilities = { codecs: { mimeType: string }[] } | null

interface EncodingInfoApi {
  encodingInfo(config: unknown): Promise<{ supported: boolean; powerEfficient: boolean }>
}

/** Codecs que dependem da placa de vídeo e como o Chromium os chama. */
const QUERIED: { codec: Exclude<ScreenVideoCodec, 'vp8'>; mime: string; mode?: string }[] = [
  // O LiveKit publica tela em AV1 com L1T3: a pergunta inclui o modo.
  { codec: 'av1', mime: 'video/AV1', mode: 'L1T3' },
  { codec: 'h265', mime: 'video/H265' },
  { codec: 'h264', mime: 'video/H264' }
]

/** Uma live nesse codec caiu no processador: as próximas o tratam como software. */
const softwareKey = (codec: ScreenVideoCodec): string => `salinha:screen-${codec}-software`

const senderCapabilities = (): SenderCapabilities =>
  globalThis.RTCRtpSender?.getCapabilities?.('video') ?? null

const hasCodec = (capabilities: SenderCapabilities, mime: string): boolean =>
  !!capabilities?.codecs.some((codec) => codec.mimeType.toLowerCase() === mime.toLowerCase())

function markedSoftware(codec: ScreenVideoCodec): boolean {
  try {
    return localStorage.getItem(softwareKey(codec)) === '1'
  } catch {
    return false
  }
}

/** powerEfficient = encoder da placa de vídeo (o Chromium responde pelo encoder da GPU). */
async function encoderOf(
  query: (typeof QUERIED)[number],
  video: ScreenVideoShape,
  api: EncodingInfoApi | undefined
): Promise<CodecEncoder> {
  if (!api || markedSoftware(query.codec)) return 'software'
  try {
    const mode = query.mode ? { scalabilityMode: query.mode } : {}
    const info = await api.encodingInfo({
      type: 'webrtc',
      video: { contentType: query.mime, ...mode, ...video }
    })
    if (!info.supported) return null
    return info.powerEfficient ? 'hardware' : 'software'
  } catch {
    return 'software'
  }
}

export async function screenCodecSupport(
  video: ScreenVideoShape,
  api: EncodingInfoApi | undefined,
  capabilities: SenderCapabilities
): Promise<ScreenCodecSupport> {
  const support: ScreenCodecSupport = { av1: null, h265: null, h264: null, vp8: 'software' }
  for (const query of QUERIED) {
    if (hasCodec(capabilities, query.mime))
      support[query.codec] = await encoderOf(query, video, api)
  }
  return support
}

const cache = new Map<string, Promise<ScreenCodecSupport>>()

/** Detecção com cache por sessão (por tamanho/fps/bitrate da live). */
export function detectScreenCodecs(video: ScreenVideoShape): Promise<ScreenCodecSupport> {
  const key = `${video.width}x${video.height}@${video.framerate}:${video.bitrate}`
  let support = cache.get(key)
  if (!support) {
    const api = globalThis.navigator?.mediaCapabilities as EncodingInfoApi | undefined
    support = screenCodecSupport(video, api, senderCapabilities())
    cache.set(key, support)
  }
  return support
}

export function clearScreenCodecCache(): void {
  cache.clear()
}

/** Uma live em AV1/H.265 saiu pelo processador: não usar esse codec de novo neste aparelho. */
export function markSoftwareCodec(codec: ScreenVideoCodec): void {
  try {
    localStorage.setItem(softwareKey(codec), '1')
  } catch {
    /* Compartilhar continua funcionando sem armazenamento local. */
  }
  cache.clear()
}
