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

/** Ajusta a fonte dentro da caixa escolhida, sem ampliar nem alterar proporção. */
export function screenVideoConstraints(
  quality: ScreenShareQuality,
  source: MediaTrackSettings
): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    frameRate: { ideal: quality.frameRate, max: quality.frameRate }
  }
  if (quality.resolution === 'source') return constraints
  const width = quality.resolution === '720p' ? 1280 : 1920
  const height = quality.resolution === '720p' ? 720 : 1080
  const scale = Math.min(1, width / (source.width || width), height / (source.height || height))
  constraints.width = { max: Math.max(1, Math.floor((source.width || width) * scale)) }
  constraints.height = { max: Math.max(1, Math.floor((source.height || height) * scale)) }
  return constraints
}

export function screenEncoding(
  quality: ScreenShareQuality,
  settings: MediaTrackSettings = {}
): {
  maxBitrate: number
  maxFramerate: number
} {
  const pixels =
    quality.resolution === '720p'
      ? 1280 * 720
      : quality.resolution === '1080p'
        ? 1920 * 1080
        : (settings.width || 1920) * (settings.height || 1080)
  // Orçamento proporcional ao tamanho e FPS, com teto para fontes muito grandes.
  const base = Math.max(2_500_000, Math.min(16_000_000, (4_000_000 * pixels) / (1920 * 1080)))
  return {
    maxBitrate: Math.round((base * quality.frameRate) / 30),
    maxFramerate: quality.frameRate
  }
}

export function rememberStreamQuality(stream: MediaStream, quality: ScreenShareQuality): void {
  streamQualities.set(stream, { ...quality })
}

export function streamQuality(stream: MediaStream): ScreenShareQuality {
  return { ...(streamQualities.get(stream) ?? DEFAULT_SCREEN_QUALITY) }
}

/**
 * Jogo (60 fps) quer fluidez: 'motion' + manter fps (cai a resolução se faltar
 * banda/CPU). Texto e apresentação (30 fps) querem nitidez: 'detail' + manter
 * a resolução. Com 'detail' em 60 fps um jogo pesado caía para 4–8 fps.
 */
export function screenMotion(frameRate: ScreenShareQuality['frameRate']): {
  contentHint: 'motion' | 'detail'
  degradationPreference: RTCDegradationPreference
} {
  return frameRate === 60
    ? { contentHint: 'motion', degradationPreference: 'maintain-framerate' }
    : { contentHint: 'detail', degradationPreference: 'maintain-resolution' }
}
