import { describe, expect, it } from 'vitest'
import type { NowPlaying } from './mediaSessions'
import {
  IDLE_GRACE_MS,
  INITIAL_TRACKER,
  MIN_RESEND_MS,
  SEEK_TOLERANCE_MS,
  stepTracker,
  type TrackerState
} from './musicTracker'

const song: NowPlaying = {
  app: 'Spotify',
  title: 'Águas de Março',
  artist: 'Elis Regina',
  album: 'Elis & Tom',
  playing: true,
  positionMs: 10_000,
  durationMs: 225_000
}

/** Roda uma sequência de leituras e junta o que seria mandado ao renderer. */
function run(reads: [NowPlaying | null, number][]): { state: TrackerState; sent: unknown[] } {
  let state = INITIAL_TRACKER
  const sent: unknown[] = []
  for (const [playing, now] of reads) {
    const step = stepTracker(state, playing, now)
    state = step.state
    if (step.emit !== undefined) sent.push(step.emit)
  }
  return { state, sent }
}

describe('stepTracker', () => {
  it('manda a faixa com o início calculado (agora - posição)', () => {
    const { sent } = run([[song, 100_000]])
    expect(sent).toEqual([
      {
        app: 'Spotify',
        title: 'Águas de Março',
        artist: 'Elis Regina',
        album: 'Elis & Tom',
        durationMs: 225_000,
        startedAt: 90_000
      }
    ])
  })

  it('não reenvia enquanto a mesma faixa segue tocando', () => {
    const { sent } = run([
      [song, 100_000],
      [{ ...song, positionMs: 12_000 }, 102_000],
      [{ ...song, positionMs: 14_100 }, 104_000]
    ])
    expect(sent).toHaveLength(1)
  })

  it('troca de faixa vai na hora', () => {
    const next = { ...song, title: 'Garota de Ipanema', positionMs: 0 }
    const { sent } = run([
      [song, 100_000],
      [next, 101_000]
    ])
    expect(sent).toHaveLength(2)
    expect(sent[1]).toMatchObject({ title: 'Garota de Ipanema', startedAt: 101_000 })
  })

  it('seek grande reenvia, mas no máximo um por janela', () => {
    const jump = (positionMs: number, now: number): [NowPlaying, number] => [
      { ...song, positionMs },
      now
    ]
    const early = run([[song, 100_000], jump(100_000, 101_000)])
    // Pulou cedo demais depois do último envio: espera a janela passar.
    expect(early.sent).toHaveLength(1)

    const later = 100_000 + MIN_RESEND_MS
    const { sent } = run([
      [song, 100_000],
      jump(100_000, 101_000),
      jump(100_000 + later - 101_000, later)
    ])
    expect(sent).toHaveLength(2)
    expect(sent[1]).toMatchObject({ startedAt: 1_000 })
  })

  it('deslize pequeno do relógio não conta como seek', () => {
    const drift = SEEK_TOLERANCE_MS - 500
    const { sent } = run([
      [song, 100_000],
      [{ ...song, positionMs: 10_000 + 30_000 - drift }, 100_000 + 30_000]
    ])
    expect(sent).toHaveLength(1)
  })

  it('posição zero na mesma faixa (player que não informa) não reenvia', () => {
    const { sent } = run([
      [{ ...song, positionMs: 0 }, 100_000],
      [{ ...song, positionMs: 0 }, 100_000 + MIN_RESEND_MS + 10_000]
    ])
    expect(sent).toHaveLength(1)
  })

  it('pausa curta não limpa; pausa longa limpa', () => {
    const paused = { ...song, playing: false }
    const short = run([
      [song, 100_000],
      [paused, 102_000],
      [paused, 102_000 + IDLE_GRACE_MS - 1]
    ])
    expect(short.sent).toHaveLength(1)

    const long = run([
      [song, 100_000],
      [paused, 102_000],
      [paused, 102_000 + IDLE_GRACE_MS]
    ])
    expect(long.sent).toEqual([expect.anything(), null])
    expect(long.state).toEqual(INITIAL_TRACKER)
  })

  it('nada tocando conta como pausa', () => {
    const { sent } = run([
      [song, 100_000],
      [null, 101_000],
      [null, 101_000 + IDLE_GRACE_MS]
    ])
    expect(sent).toEqual([expect.anything(), null])
  })

  it('voltar a tocar depois de pausa curta reenvia o novo início', () => {
    const paused = { ...song, playing: false }
    const { sent } = run([
      [song, 100_000],
      [paused, 101_000],
      // Ficou pausado 8 s: o início "andou" 8 s.
      [{ ...song, positionMs: 11_000 }, 100_000 + MIN_RESEND_MS + 9_000]
    ])
    expect(sent).toHaveLength(2)
  })

  it('pausado desde o começo não manda nada', () => {
    const { sent } = run([[{ ...song, playing: false }, 100_000]])
    expect(sent).toEqual([])
  })
})
