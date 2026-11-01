import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaSession } from './mediaSessions'
import { createMusicDetector, platformWatcher, type SessionWatcher } from './musicDetector'
import { IDLE_GRACE_MS } from './musicTracker'

const spotify: MediaSession = {
  source: 'Spotify.exe',
  title: 'Águas de Março',
  artist: 'Elis Regina',
  album: 'Elis & Tom',
  playing: true,
  positionMs: 10_000,
  durationMs: 225_000
}

/** Fonte de sessões falsa: o teste empurra leituras com `push`. */
function fakeWatcher(): {
  watcher: SessionWatcher
  push: (s: MediaSession[]) => void
  stopped: () => boolean
} {
  let emit: ((s: MediaSession[]) => void) | null = null
  let stopped = false
  return {
    watcher: (onSessions) => {
      emit = onSessions
      return () => {
        stopped = true
      }
    },
    push: (s) => emit?.(s),
    stopped: () => stopped
  }
}

describe('createMusicDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
  })
  afterEach(() => vi.useRealTimers())

  it('avisa a faixa nova e guarda como atual', () => {
    const fake = fakeWatcher()
    const onChange = vi.fn()
    const detector = createMusicDetector(fake.watcher)
    detector.start(onChange)
    fake.push([spotify])
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Águas de Março', startedAt: 90_000 })
    )
    expect(detector.current()?.app).toBe('Spotify')
  })

  it('a fonte calada (PowerShell caiu) acaba limpando a música', () => {
    const fake = fakeWatcher()
    const onChange = vi.fn()
    const detector = createMusicDetector(fake.watcher)
    detector.start(onChange)
    fake.push([spotify])
    vi.advanceTimersByTime(IDLE_GRACE_MS * 3)
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(detector.current()).toBeNull()
  })

  it('leituras frescas da mesma faixa não reenviam', () => {
    const fake = fakeWatcher()
    const onChange = vi.fn()
    createMusicDetector(fake.watcher).start(onChange)
    for (let i = 1; i <= 10; i++) {
      vi.advanceTimersByTime(2000)
      fake.push([{ ...spotify, positionMs: 10_000 + i * 2000 }])
    }
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('parar desliga a fonte e limpa a música', () => {
    const fake = fakeWatcher()
    const onChange = vi.fn()
    const detector = createMusicDetector(fake.watcher)
    detector.start(onChange)
    fake.push([spotify])
    detector.stop()
    expect(fake.stopped()).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(detector.current()).toBeNull()
  })

  it('sem fonte (macOS) não faz nada', () => {
    const onChange = vi.fn()
    const detector = createMusicDetector(null)
    detector.start(onChange)
    detector.stop()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('platformWatcher', () => {
  it('Windows e Linux têm fonte; o resto não', () => {
    expect(platformWatcher('win32')).toBeTypeOf('function')
    expect(platformWatcher('linux')).toBeTypeOf('function')
    expect(platformWatcher('darwin')).toBeNull()
  })
})
