import { describe, expect, it } from 'vitest'
import {
  listeningFriends,
  listeningPayload,
  listeningSummary,
  sanitizeDetectedTrack,
  sanitizeListening,
  trackProgress
} from './listeningActivity'

describe('sanitizeListening', () => {
  it('aceita o formato do servidor', () => {
    expect(
      sanitizeListening({
        app: 'Spotify',
        title: ' Águas de Março ',
        artist: 'Elis Regina',
        album: 'Elis & Tom',
        started_at: 1000,
        duration_ms: 225_000
      })
    ).toEqual({
      app: 'Spotify',
      title: 'Águas de Março',
      artist: 'Elis Regina',
      album: 'Elis & Tom',
      started_at: 1000,
      duration_ms: 225_000
    })
  })

  it('campos opcionais vazios ou de tipo errado somem', () => {
    expect(
      sanitizeListening({
        app: 'Deezer',
        title: 'x',
        artist: 3,
        album: '',
        started_at: 5,
        duration_ms: -1
      })
    ).toEqual({ app: 'Deezer', title: 'x', started_at: 5 })
  })

  it('sem app, título ou início vira null', () => {
    expect(sanitizeListening(null)).toBeNull()
    expect(sanitizeListening({ app: 'Spotify', title: '', started_at: 1 })).toBeNull()
    expect(sanitizeListening({ app: '', title: 'x', started_at: 1 })).toBeNull()
    expect(sanitizeListening({ app: 'Spotify', title: 'x', started_at: Number.NaN })).toBeNull()
  })
})

describe('sanitizeDetectedTrack', () => {
  it('valida o que veio do main', () => {
    const track = {
      app: 'Spotify',
      title: 'x',
      artist: 'y',
      album: '',
      durationMs: 1000,
      startedAt: 5
    }
    expect(sanitizeDetectedTrack(track)).toEqual(track)
    expect(sanitizeDetectedTrack({ ...track, durationMs: 'a' })).toEqual({
      ...track,
      durationMs: 0
    })
    expect(sanitizeDetectedTrack({ ...track, title: 7 })).toBeNull()
    expect(sanitizeDetectedTrack(undefined)).toBeNull()
  })
})

describe('listeningPayload', () => {
  it('manda a posição (o servidor calcula o início pelo relógio dele)', () => {
    const track = {
      app: 'Spotify',
      title: 'x',
      artist: 'y',
      album: 'z',
      durationMs: 200_000,
      startedAt: 10_000
    }
    expect(listeningPayload(track, 70_000)).toEqual({
      kind: 'listening',
      app: 'Spotify',
      title: 'x',
      artist: 'y',
      album: 'z',
      position_ms: 60_000,
      duration_ms: 200_000
    })
    expect(listeningPayload(track, 5_000).position_ms).toBe(0)
  })
})

describe('trackProgress', () => {
  it('tempo decorrido, total e fração da barra', () => {
    expect(trackProgress(10_000, 200_000, 93_000)).toEqual({
      elapsed: '1:23',
      total: '3:20',
      ratio: 83_000 / 200_000
    })
  })

  it('não passa do fim nem fica negativo', () => {
    expect(trackProgress(0, 60_000, 500_000)).toMatchObject({ elapsed: '1:00', ratio: 1 })
    expect(trackProgress(10_000, 60_000, 0)).toMatchObject({ elapsed: '0:00', ratio: 0 })
  })

  it('sem duração: só o decorrido, sem barra', () => {
    expect(trackProgress(0, undefined, 61_000)).toEqual({
      elapsed: '1:01',
      total: null,
      ratio: null
    })
  })
})

describe('listeningFriends', () => {
  it('quem ouve e não está jogando, a faixa mais recente primeiro', () => {
    const friends = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const byUser = {
      a: { app: 'Spotify', title: 'x', started_at: 10 },
      b: { app: 'Deezer', title: 'y', started_at: 30 },
      c: { app: 'Spotify', title: 'z', started_at: 20 }
    }
    expect(listeningFriends(friends, byUser, new Set(['b'])).map((p) => p.friend.id)).toEqual([
      'c',
      'a'
    ])
  })
})

describe('listeningSummary', () => {
  it('título, artista (se houver) e o player', () => {
    expect(
      listeningSummary({
        app: 'Spotify',
        title: 'Águas de Março',
        artist: 'Elis Regina',
        started_at: 0
      })
    ).toBe('Ouvindo Águas de Março, de Elis Regina (Spotify)')
    expect(listeningSummary({ app: 'Deezer', title: 'x', started_at: 0 })).toBe(
      'Ouvindo x (Deezer)'
    )
  })
})
