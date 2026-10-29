import { describe, expect, it } from 'vitest'
import { cleanText, nowPlayingOf, pickNowPlaying, type MediaSession } from './mediaSessions'

const spotify: MediaSession = {
  source: 'Spotify.exe',
  title: 'Águas de Março',
  artist: 'Elis Regina',
  album: 'Elis & Tom',
  playing: true,
  positionMs: 83_000,
  durationMs: 225_000
}

describe('nowPlayingOf', () => {
  it('troca o id da sessão pelo nome do player', () => {
    expect(nowPlayingOf(spotify)).toEqual({
      app: 'Spotify',
      title: 'Águas de Março',
      artist: 'Elis Regina',
      album: 'Elis & Tom',
      playing: true,
      positionMs: 83_000,
      durationMs: 225_000
    })
  })

  it('app desconhecido ou sem título não vira música', () => {
    expect(nowPlayingOf({ ...spotify, source: 'Microsoft.ZuneVideo' })).toBeNull()
    expect(nowPlayingOf({ ...spotify, title: '   ' })).toBeNull()
  })

  it('navegador só conta com álbum (música) ou site de música', () => {
    const video = { ...spotify, source: 'Chrome', album: '' }
    expect(nowPlayingOf(video)).toBeNull()
    expect(nowPlayingOf({ ...video, album: 'Elis & Tom' })?.app).toBe('Chrome')
    expect(nowPlayingOf({ ...video, url: 'https://music.youtube.com/watch?v=1' })?.app).toBe(
      'YouTube Music'
    )
  })

  it('posição e duração inválidas viram zero', () => {
    const got = nowPlayingOf({ ...spotify, positionMs: -5, durationMs: Number.NaN })
    expect(got?.positionMs).toBe(0)
    expect(got?.durationMs).toBe(0)
  })
})

describe('cleanText', () => {
  it('tira espaços e quebras de linha e corta no limite sem partir emoji', () => {
    expect(cleanText('  a\n\tb  ', 10)).toBe('a b')
    expect(cleanText('😀😀😀', 2)).toBe('😀😀')
  })
})

describe('pickNowPlaying', () => {
  it('prefere o que está tocando ao que está pausado', () => {
    const paused = { ...spotify, source: 'deezer', title: 'Outra', playing: false }
    expect(pickNowPlaying([paused, spotify])?.title).toBe('Águas de Março')
  })

  it('sem nada tocando, devolve o primeiro pausado', () => {
    const paused = { ...spotify, playing: false }
    expect(pickNowPlaying([paused])?.playing).toBe(false)
  })

  it('ignora sessões que não são música', () => {
    expect(pickNowPlaying([{ ...spotify, source: 'mpv' }])).toBeNull()
    expect(pickNowPlaying([])).toBeNull()
  })
})
