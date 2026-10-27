import type { NowPlaying } from './mediaSessions'

// Decide quando a música detectada vai para o servidor. Nada de atualizar a
// cada segundo: vai o início (agora - posição) e a duração, e só se reenvia
// ao trocar de faixa, voltar de uma pausa ou pular para outro ponto (seek).
// Quem vê calcula o tempo decorrido sozinho. Puro.

/** A faixa como vai ao renderer (e dele ao servidor). */
export interface DetectedTrack {
  app: string
  title: string
  artist: string
  album: string
  durationMs: number
  /** Unix em ms de quando a faixa começou (agora - posição). */
  startedAt: number
}

export interface TrackerState {
  /** O que o renderer recebeu por último (null = nada tocando). */
  sent: DetectedTrack | null
  /** Quando foi o último envio de faixa. */
  sentAt: number
  /** Desde quando está pausado ou sem nada (null = tocando). */
  idleSince: number | null
}

export const INITIAL_TRACKER: TrackerState = { sent: null, sentAt: 0, idleSince: null }

/** Pausado (ou sem nada) por tanto tempo limpa a atividade. */
export const IDLE_GRACE_MS = 10_000
/** Diferença de início abaixo disso é deslize do relógio, não seek. */
export const SEEK_TOLERANCE_MS = 3_000
/** Correção de início (seek, volta da pausa) da mesma faixa: no máximo uma por janela. */
export const MIN_RESEND_MS = 15_000

/** O que fazer agora: `emit` ausente = nada; null = limpar; faixa = mandar. */
export interface TrackerStep {
  state: TrackerState
  emit?: DetectedTrack | null
}

function trackOf(playing: NowPlaying, now: number): DetectedTrack {
  return {
    app: playing.app,
    title: playing.title,
    artist: playing.artist,
    album: playing.album,
    durationMs: playing.durationMs,
    startedAt: now - playing.positionMs
  }
}

function sameSong(a: DetectedTrack, b: DetectedTrack): boolean {
  return (
    a.app === b.app &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.album === b.album &&
    Math.abs(a.durationMs - b.durationMs) < 1000
  )
}

/** Mesma faixa: só reenvia se o início andou de verdade e a janela já passou. */
function needsResend(
  state: TrackerState,
  playing: NowPlaying,
  track: DetectedTrack,
  now: number
): boolean {
  const sent = state.sent as DetectedTrack
  // Posição zero na mesma faixa: o player não informa a posição; mantém o início.
  if (playing.positionMs === 0) return false
  if (Math.abs(sent.startedAt - track.startedAt) <= SEEK_TOLERANCE_MS) return false
  return now - state.sentAt >= MIN_RESEND_MS
}

function idleStep(state: TrackerState, now: number): TrackerStep {
  if (!state.sent) return { state }
  const idleSince = state.idleSince ?? now
  if (now - idleSince < IDLE_GRACE_MS) return { state: { ...state, idleSince } }
  return { state: INITIAL_TRACKER, emit: null }
}

/** Um passo: o que o player mostra agora (null = nenhuma música) → novo estado e o que mandar. */
export function stepTracker(
  state: TrackerState,
  playing: NowPlaying | null,
  now: number
): TrackerStep {
  if (!playing?.playing) return idleStep(state, now)
  const track = trackOf(playing, now)
  const playingAgain = { ...state, idleSince: null }
  if (state.sent && sameSong(state.sent, track) && !needsResend(state, playing, track, now)) {
    return { state: playingAgain }
  }
  return { state: { sent: track, sentAt: now, idleSince: null }, emit: track }
}
