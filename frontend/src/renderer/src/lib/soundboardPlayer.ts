import { soundFileUrl } from '../api/soundboard'
import { ensureMediaToken } from '../store/mediaToken'
import { routeElementToOutput, type VoiceRoute } from './voiceOutput'

const activeClips = new Map<HTMLAudioElement, VoiceRoute>()

export function setActiveSoundboardVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume))
  activeClips.forEach((route) => route.setVolume(clamped))
}

export function stopAllSoundboardAudio(): void {
  activeClips.forEach((route, el) => {
    try {
      el.pause()
      el.removeAttribute('src')
      el.load()
    } catch {
      // ignora em ambiente de teste
    }
    route.stop()
  })
  activeClips.clear()
}

export async function playSoundboardClip(opts: {
  soundId: string
  volume: number
  onEnded?: () => void
}): Promise<void> {
  const clampedVolume = Math.max(0, Math.min(1, opts.volume))
  if (clampedVolume <= 0 || typeof Audio === 'undefined') {
    return
  }

  let token: string
  try {
    token = await ensureMediaToken()
  } catch {
    return
  }

  // CORS: o Web Audio só lê a mídia de outra origem com a requisição anônima.
  const el = new Audio()
  el.crossOrigin = 'anonymous'
  el.src = soundFileUrl(opts.soundId, token)
  const route = routeElementToOutput(el, clampedVolume)
  activeClips.set(el, route)

  const cleanup = (): void => {
    if (!activeClips.has(el)) return
    activeClips.delete(el)
    route.stop()
    opts.onEnded?.()
  }

  el.addEventListener('ended', cleanup, { once: true })
  el.addEventListener('error', cleanup, { once: true })

  try {
    await el.play()
  } catch {
    cleanup()
  }
}
