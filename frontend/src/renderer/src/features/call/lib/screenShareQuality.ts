export type ScreenShareQuality = {
  resolution: '720p' | '1080p' | 'source'
  frameRate: 30 | 60
}

export const DEFAULT_SCREEN_QUALITY: ScreenShareQuality = { resolution: '1080p', frameRate: 30 }
const STORAGE_KEY = 'salinha:screen-share-quality'
let memoryQuality: ScreenShareQuality | null = null
const streamQualities = new WeakMap<MediaStream, ScreenShareQuality>()
const screenSources = new WeakMap<MediaStreamTrack, MediaTrackSettings>()

/** Guarda a fonte antes de reduzir a captura, permitindo aumentar a qualidade depois. */
export function rememberScreenSource(track: MediaStreamTrack): void {
  screenSources.set(track, { ...track.getSettings() })
}

export function screenSource(track: MediaStreamTrack): MediaTrackSettings {
  return screenSources.get(track) ?? track.getSettings()
}

export function loadScreenQuality(): ScreenShareQuality {
  if (memoryQuality) return { ...memoryQuality }
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (
      value &&
      ['720p', '1080p', 'source'].includes(value.resolution) &&
      [30, 60].includes(value.frameRate)
    )
      return { resolution: value.resolution, frameRate: value.frameRate }
  } catch {
    /* Preferências indisponíveis ou inválidas: usa o padrão. */
  }
  return { ...DEFAULT_SCREEN_QUALITY }
}

export function saveScreenQuality(quality: ScreenShareQuality): void {
  memoryQuality = { ...quality }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quality))
  } catch {
    /* Compartilhar continua funcionando sem armazenamento local. */
  }
}

/** Caixa de cada preset. Fonte vai até 1440p (teto dos apps de live). */
const BOX: Record<ScreenShareQuality['resolution'], { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  source: { width: 2560, height: 1440 }
}

/**
 * Bitrate de referência do mercado (Twitch: 720p30 3, 720p60 4,5, 1080p30 4,5,
 * 1080p60 6–8 Mbps; YouTube 1440p 6–13). Ver docs/adr/0020.
 */
const BITRATE: Record<ScreenShareQuality['resolution'], Record<30 | 60, number>> = {
  '720p': { 30: 3_000_000, 60: 4_500_000 },
  '1080p': { 30: 4_500_000, 60: 7_000_000 },
  source: { 30: 8_000_000, 60: 10_000_000 }
}

/** Tamanho da fonte dentro da caixa do preset, sem ampliar nem alterar proporção. */
export function captureSize(
  resolution: ScreenShareQuality['resolution'],
  source: MediaTrackSettings
): { width: number; height: number } {
  const box = BOX[resolution]
  const width = source.width || box.width
  const height = source.height || box.height
  const scale = Math.min(1, box.width / width, box.height / height)
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale))
  }
}

/** Ajusta a fonte dentro da caixa escolhida, sem ampliar nem alterar proporção. */
export function screenVideoConstraints(
  quality: ScreenShareQuality,
  source: MediaTrackSettings
): MediaTrackConstraints {
  const size = captureSize(quality.resolution, source)
  return {
    frameRate: { ideal: quality.frameRate, max: quality.frameRate },
    width: { max: size.width },
    height: { max: size.height }
  }
}

export function screenEncoding(
  quality: ScreenShareQuality,
  source: MediaTrackSettings = {}
): {
  maxBitrate: number
  maxFramerate: number
} {
  const fps = quality.frameRate
  let maxBitrate = BITRATE[quality.resolution][fps]
  if (quality.resolution === 'source') {
    // Entre 1080p e 1440p, proporcional aos pixels da fonte.
    const { width, height } = captureSize('source', source)
    const full = BITRATE['1080p'][fps]
    maxBitrate = Math.min(maxBitrate, Math.max(full, (full * width * height) / (1920 * 1080)))
  }
  return { maxBitrate: Math.round(maxBitrate), maxFramerate: fps }
}

export function rememberStreamQuality(stream: MediaStream, quality: ScreenShareQuality): void {
  streamQualities.set(stream, { ...quality })
}

export function streamQuality(stream: MediaStream): ScreenShareQuality {
  return { ...(streamQualities.get(stream) ?? DEFAULT_SCREEN_QUALITY) }
}

/**
 * Jogo (60 fps) = 'motion'; texto e apresentação (30 fps) = 'detail'. A
 * resolução é sempre mantida: o WebRTC sozinho derrubava para 180p (rampa da
 * banda) ou segurava 1080p a 5 fps. Quem troca de degrau, sem nunca passar de
 * 720p30, é o controlador (screenAdaptController). Ver docs/adr/0020.
 */
export function screenMotion(frameRate: ScreenShareQuality['frameRate']): {
  contentHint: 'motion' | 'detail'
  degradationPreference: RTCDegradationPreference
} {
  return {
    contentHint: frameRate === 60 ? 'motion' : 'detail',
    degradationPreference: 'maintain-resolution'
  }
}
