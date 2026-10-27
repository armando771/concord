import { pickNowPlaying, type MediaSession } from './mediaSessions'
import { watchMpris } from './mprisMedia'
import { watchSmtc } from './smtcMedia'
import { INITIAL_TRACKER, stepTracker, type DetectedTrack, type TrackerState } from './musicTracker'

// "Ouvindo": junta a fonte de sessões da plataforma (SMTC no Windows, MPRIS no
// Linux) com o musicTracker e avisa quem ouve só quando a música muda.

/** Começa a ler as sessões de mídia; devolve o "parar". */
export type SessionWatcher = (onSessions: (sessions: MediaSession[]) => void) => () => void

/** A fonte desta plataforma; null onde não há (macOS). */
export function platformWatcher(
  platform: NodeJS.Platform = process.platform
): SessionWatcher | null {
  if (platform === 'win32') return watchSmtc
  if (platform === 'linux') return watchMpris
  return null
}

/** Sem leitura nova da fonte por tanto tempo, vale como "nada tocando". */
const STALE_MS = 10_000
const CHECK_INTERVAL_MS = 2000

export interface MusicDetector {
  /** `onChange` roda quando a música muda (null = parou). */
  start(onChange: (track: DetectedTrack | null) => void): void
  stop(): void
  /** Música atual (para quem liga o detector depois da janela abrir). */
  current(): DetectedTrack | null
}

export function createMusicDetector(watcher: SessionWatcher | null): MusicDetector {
  let stopWatch: (() => void) | null = null
  let timer: NodeJS.Timeout | null = null
  let latestAt = 0
  let state: TrackerState = INITIAL_TRACKER
  let current: DetectedTrack | null = null
  let notify: (track: DetectedTrack | null) => void = () => {}

  const step = (sessions: readonly MediaSession[]): void => {
    const next = stepTracker(state, pickNowPlaying(sessions), Date.now())
    state = next.state
    if (next.emit === undefined) return
    current = next.emit
    notify(current)
  }

  const onSessions = (sessions: MediaSession[]): void => {
    latestAt = Date.now()
    step(sessions)
  }

  // A fonte pode calar (PowerShell caiu): sem leitura fresca, a pausa corre igual.
  const checkStale = (): void => {
    if (Date.now() - latestAt > STALE_MS) step([])
  }

  return {
    start(onChange) {
      notify = onChange
      if (stopWatch || !watcher) return
      latestAt = Date.now()
      stopWatch = watcher(onSessions)
      timer = setInterval(checkStale, CHECK_INTERVAL_MS)
    },
    stop() {
      stopWatch?.()
      stopWatch = null
      if (timer) clearInterval(timer)
      timer = null
      state = INITIAL_TRACKER
      if (!current) return
      current = null
      notify(null)
    },
    current: () => current
  }
}
