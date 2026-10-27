import { describe, expect, it } from 'vitest'
import { MUSIC_APPS, musicAccent, musicSourceFor } from './musicApps'

describe('musicSourceFor', () => {
  it('reconhece o app pelo AUMID do Windows', () => {
    expect(musicSourceFor('Spotify.exe')).toEqual({ app: 'Spotify', browser: false })
    expect(musicSourceFor('SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify')?.app).toBe('Spotify')
    expect(musicSourceFor('AppleInc.AppleMusicWin_nzyj5cx40ttqa!App')?.app).toBe('Apple Music')
    expect(musicSourceFor('Deezer.62021768415AF_q7m17pa7muskm!Deezer.Music')?.app).toBe('Deezer')
    expect(musicSourceFor('com.github.th-ch.youtube-music')?.app).toBe('YouTube Music')
  })

  it('reconhece o app pelo nome no MPRIS (Linux), sem diferenciar maiúsculas', () => {
    expect(musicSourceFor('spotify Spotify')?.app).toBe('Spotify')
    expect(musicSourceFor('vlc VLC media player')?.app).toBe('VLC')
  })

  it('o site do player vence o navegador', () => {
    expect(
      musicSourceFor('chromium.instance42 Google Chrome', 'https://music.youtube.com/watch?v=x')
    ).toEqual({
      app: 'YouTube Music',
      browser: false
    })
    expect(musicSourceFor('firefox', 'https://open.spotify.com/track/1')?.app).toBe('Spotify')
  })

  it('navegador sem site conhecido devolve o nome dele, marcado como navegador', () => {
    expect(musicSourceFor('Chrome')).toEqual({ app: 'Chrome', browser: true })
    expect(musicSourceFor('MSEdge')).toEqual({ app: 'Edge', browser: true })
    expect(musicSourceFor('chromium.instance7 Google Chrome')?.app).toBe('Chrome')
    expect(musicSourceFor('chromium.instance7 Chromium')?.app).toBe('Chromium')
  })

  it('app desconhecido não vira música', () => {
    expect(musicSourceFor('Microsoft.ZuneVideo_8wekyb3d8bbwe!Microsoft.ZuneVideo')).toBeNull()
    expect(musicSourceFor('')).toBeNull()
    expect(musicSourceFor('mpv', 'https://example.com/')).toBeNull()
  })

  it('site com endereço inválido é ignorado', () => {
    expect(musicSourceFor('Chrome', 'não é url')).toEqual({ app: 'Chrome', browser: true })
  })
})

describe('MUSIC_APPS', () => {
  it('ids em minúsculas e sem repetir entre apps', () => {
    const ids = MUSIC_APPS.flatMap((app) => app.ids)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id === id.toLowerCase())).toBe(true)
  })

  it('cor pelo nome', () => {
    expect(musicAccent('Spotify')).toBe('#1ed760')
    expect(musicAccent('Chrome')).toBeUndefined()
  })
})
