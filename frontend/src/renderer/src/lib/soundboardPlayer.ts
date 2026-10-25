import { soundFileUrl } from '../api/soundboard'
import { ensureMediaToken } from '../store/mediaToken'

type SinkAudioElement = HTMLAudioElement & {
  setSinkId?: (id: string) => Promise<void>
}

const activeElements = new Set<SinkAudioElement>()

export function setActiveSoundboardVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume))
  activeElements.forEach((el) => {
    el.volume = clamped
  })
}

export function stopAllSoundboardAudio(): void {
  activeElements.forEach((el) => {
    try {
      el.pause()
      el.removeAttribute('src')
      el.load()
    } catch {
      // ignora em ambiente de teste
    }
  })
  activeElements.clear()
}

export async function playSoundboardClip(opts: {
  soundId: string
  volume: number
  outputDeviceId: string
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

  const el = new Audio(soundFileUrl(opts.soundId, token)) as SinkAudioElement
  el.volume = clampedVolume
  if (opts.outputDeviceId && typeof el.setSinkId === 'function') {
    void el.setSinkId(opts.outputDeviceId).catch(() => {})
  }

  activeElements.add(el)
  const cleanup = (): void => {
    if (!activeElements.has(el)) return
    activeElements.delete(el)
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
