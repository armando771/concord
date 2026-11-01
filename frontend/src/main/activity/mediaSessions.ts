import { musicSourceFor } from '../../shared/musicApps'

// "Ouvindo": as sessões de mídia do sistema (SMTC no Windows, MPRIS no Linux)
// num formato só, e qual delas vira a música da atividade. Puro.

/** Uma sessão de mídia como o sistema informa. */
export interface MediaSession {
  /** Quem toca: o AUMID (Windows) ou "nome-no-barramento Identity" (Linux). */
  source: string
  /** Endereço da página, quando o player informa (navegador no Linux). */
  url?: string
  title: string
  artist: string
  album: string
  playing: boolean
  positionMs: number
  durationMs: number
}

/** A música reconhecida, já com o nome do player. */
export interface NowPlaying {
  app: string
  title: string
  artist: string
  album: string
  playing: boolean
  positionMs: number
  durationMs: number
}

// Os mesmos limites do servidor (listening.go).
const MAX_APP_CHARS = 64
const MAX_TEXT_CHARS = 128

/** Uma linha só, sem espaços sobrando, cortada em `max` caracteres (sem partir emoji). */
export function cleanText(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return Array.from(flat).slice(0, max).join('').trim()
}

function nonNegative(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0
}

/** A sessão vira música se o player é conhecido (navegador: só com álbum ou site de música). */
export function nowPlayingOf(session: MediaSession): NowPlaying | null {
  const title = cleanText(session.title, MAX_TEXT_CHARS)
  const source = musicSourceFor(session.source, session.url)
  if (!title || !source) return null
  const album = cleanText(session.album, MAX_TEXT_CHARS)
  if (source.browser && !album) return null
  return {
    app: cleanText(source.app, MAX_APP_CHARS),
    title,
    artist: cleanText(session.artist, MAX_TEXT_CHARS),
    album,
    playing: session.playing,
    positionMs: nonNegative(session.positionMs),
    durationMs: nonNegative(session.durationMs)
  }
}

/** A música da atividade: a primeira tocando; sem nenhuma, a primeira pausada. */
export function pickNowPlaying(sessions: readonly MediaSession[]): NowPlaying | null {
  const music = sessions.map(nowPlayingOf).filter((m): m is NowPlaying => m !== null)
  return music.find((m) => m.playing) ?? music[0] ?? null
}
