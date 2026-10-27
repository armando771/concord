import { formatDuration } from '../../music/lib/music'

// "Ouvindo": a música que a pessoa está ouvindo agora (Spotify, YouTube
// Music...). O servidor manda o início e a duração; o tempo decorrido é
// calculado aqui, a cada segundo, sem tráfego. Puro.

export interface ListeningActivity {
  /** Player ("Spotify"). */
  app: string
  title: string
  artist?: string
  album?: string
  /** Unix em ms de quando a faixa começou (agora - posição, no servidor). */
  started_at: number
  /** Ausente = duração desconhecida. */
  duration_ms?: number
}

/** A faixa como o main detecta (window.api.music). */
export interface DetectedTrack {
  app: string
  title: string
  artist: string
  album: string
  durationMs: number
  startedAt: number
}

type Raw = Record<string, unknown>

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null
const trimmed = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const positive = (value: unknown): number => (finite(value) && value > 0 ? value : 0)

/** Valida o que veio do servidor; fora do formato vira null. */
export function sanitizeListening(raw: unknown): ListeningActivity | null {
  if (!isRecord(raw) || !finite(raw.started_at)) return null
  const app = trimmed(raw.app)
  const title = trimmed(raw.title)
  if (!app || !title) return null
  const listening: ListeningActivity = { app, title, started_at: raw.started_at }
  const artist = trimmed(raw.artist)
  const album = trimmed(raw.album)
  const duration = positive(raw.duration_ms)
  if (artist) listening.artist = artist
  if (album) listening.album = album
  if (duration) listening.duration_ms = duration
  return listening
}

/** Valida a faixa que veio do main (IPC). */
export function sanitizeDetectedTrack(raw: unknown): DetectedTrack | null {
  if (!isRecord(raw) || typeof raw.app !== 'string' || typeof raw.title !== 'string') return null
  if (!finite(raw.startedAt)) return null
  return {
    app: raw.app,
    title: raw.title,
    artist: trimmed(raw.artist),
    album: trimmed(raw.album),
    durationMs: positive(raw.durationMs),
    startedAt: raw.startedAt
  }
}

/** activity:set da música: vai a posição de agora, e o servidor calcula o início no relógio dele. */
export function listeningPayload(track: DetectedTrack, now: number): Record<string, unknown> {
  return {
    kind: 'listening',
    app: track.app,
    title: track.title,
    artist: track.artist,
    album: track.album,
    position_ms: Math.max(0, now - track.startedAt),
    duration_ms: track.durationMs
  }
}

export interface TrackProgress {
  /** "1:23" */
  elapsed: string
  /** "3:45"; null sem duração. */
  total: string | null
  /** 0..1 para a barra; null sem duração. */
  ratio: number | null
}

/** "1:23 ━━━━──── 3:45": quanto já tocou, sem passar do fim. */
export function trackProgress(
  startedAt: number,
  durationMs: number | undefined,
  now: number
): TrackProgress {
  const played = Math.max(0, now - startedAt)
  if (!durationMs) return { elapsed: formatDuration(played), total: null, ratio: null }
  const elapsed = Math.min(played, durationMs)
  return {
    elapsed: formatDuration(elapsed),
    total: formatDuration(durationMs),
    ratio: elapsed / durationMs
  }
}

/** Amigos ouvindo agora (sem quem já aparece jogando), da faixa mais recente para a mais antiga. */
export function listeningFriends<T extends { id: string }>(
  friends: readonly T[],
  byUser: Readonly<Record<string, ListeningActivity>>,
  playing: ReadonlySet<string>
): { friend: T; listening: ListeningActivity }[] {
  const list: { friend: T; listening: ListeningActivity }[] = []
  for (const friend of friends) {
    const listening = byUser[friend.id]
    if (listening && !playing.has(friend.id)) list.push({ friend, listening })
  }
  return list.sort((a, b) => b.listening.started_at - a.listening.started_at)
}

/** Dica com tudo: "Ouvindo Águas de Março, de Elis Regina (Spotify)". */
export function listeningSummary(listening: ListeningActivity): string {
  const by = listening.artist ? `, de ${listening.artist}` : ''
  return `Ouvindo ${listening.title}${by} (${listening.app})`
}
