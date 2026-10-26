import { describe, expect, it } from 'vitest'
import {
  canSwap,
  DUCK_GAIN,
  duckTarget,
  formatDuration,
  isMaestroIdentity,
  maestroIdentity,
  slashSuggestions,
  splitBold,
  stepGain,
  videoSyncAction,
  wantsVideo,
  videoTargetSec
} from './music'
import type { MusicItem } from '../api/music'

const item = (id: string, user: string): MusicItem => ({
  id,
  video_id: 'x',
  title: id,
  artist: '',
  thumbnail: '',
  duration_ms: 1000,
  requested_by: { id: user, username: user, display_name: user },
  has_video: false,
  video_ready: false
})

describe('slashSuggestions', () => {
  it('lista os comandos ao digitar /', () => {
    expect(slashSuggestions('/').map((s) => s.command)).toEqual([
      '/play',
      '/skip',
      '/fila',
      '/help'
    ])
  })
  it('filtra pelo começo, incluindo aliases', () => {
    expect(slashSuggestions('/pu').map((s) => s.command)).toEqual(['/skip'])
    expect(slashSuggestions('/fi').map((s) => s.command)).toEqual(['/fila'])
  })
  it('some depois do espaço ou sem barra', () => {
    expect(slashSuggestions('/play queen')).toEqual([])
    expect(slashSuggestions('oi')).toEqual([])
  })
})

describe('formatação e regras', () => {
  it('formatDuration', () => {
    expect(formatDuration(355_000)).toBe('5:55')
    expect(formatDuration(3_723_000)).toBe('1:02:03')
  })
  it('identidade do bot', () => {
    expect(isMaestroIdentity('bot-music:abc')).toBe(true)
    expect(isMaestroIdentity('abc')).toBe(false)
    expect(maestroIdentity('v1')).toBe('bot-music:v1')
    expect(isMaestroIdentity(maestroIdentity('v1'))).toBe(true)
  })
  it('canSwap só entre duas músicas minhas', () => {
    expect(canSwap(item('a', 'me'), item('b', 'me'), 'me')).toBe(true)
    expect(canSwap(item('a', 'me'), item('b', 'other'), 'me')).toBe(false)
    expect(canSwap(item('a', 'me'), item('a', 'me'), 'me')).toBe(false)
  })
  it('splitBold', () => {
    expect(splitBold('🎵 @caio adicionou **Song** (5:55)')).toEqual([
      { text: '🎵 @caio adicionou ', bold: false },
      { text: 'Song', bold: true },
      { text: ' (5:55)', bold: false }
    ])
  })
})

describe('ducking', () => {
  it('abaixa quando outra pessoa fala e segura 600 ms', () => {
    const base = { meId: 'me', enabled: true, now: 10_000 }
    expect(duckTarget({ ...base, speakingIds: ['ana'], lastOtherSpeechAt: 10_000 })).toBe(DUCK_GAIN)
    expect(duckTarget({ ...base, speakingIds: ['me', 'bot-music:x'], lastOtherSpeechAt: 0 })).toBe(
      1
    )
    expect(duckTarget({ ...base, speakingIds: [], lastOtherSpeechAt: 9_600 })).toBe(DUCK_GAIN)
    expect(duckTarget({ ...base, speakingIds: [], lastOtherSpeechAt: 9_300 })).toBe(1)
    expect(
      duckTarget({ ...base, enabled: false, speakingIds: ['ana'], lastOtherSpeechAt: 10_000 })
    ).toBe(1)
  })
  it('desce em 150 ms e sobe em 600 ms', () => {
    expect(stepGain(1, DUCK_GAIN, 150)).toBeCloseTo(DUCK_GAIN)
    expect(stepGain(1, DUCK_GAIN, 75)).toBeCloseTo(1 - (1 - DUCK_GAIN) / 2)
    expect(stepGain(DUCK_GAIN, 1, 300)).toBeCloseTo(DUCK_GAIN + (1 - DUCK_GAIN) / 2)
    expect(stepGain(DUCK_GAIN, 1, 10_000)).toBe(1)
  })
})

describe('sincronia do vídeo', () => {
  it('posição alvo desconta a latência do áudio', () => {
    expect(
      videoTargetSec({ startedAt: 1_000, nowMs: 11_000, serverOffsetMs: 0, audioLatencyMs: 250 })
    ).toBeCloseTo(9.75)
    expect(
      videoTargetSec({ startedAt: 1_000, nowMs: 11_000, serverOffsetMs: 500, audioLatencyMs: 250 })
    ).toBeCloseTo(10.25)
  })
  it('nada, ajuste de velocidade ou salto', () => {
    expect(videoSyncAction(10, 10.05)).toEqual({ kind: 'none' })
    expect(videoSyncAction(10, 10.5)).toEqual({ kind: 'rate', rate: 1.05 })
    expect(videoSyncAction(10.5, 10)).toEqual({ kind: 'rate', rate: 0.95 })
    expect(videoSyncAction(10, 12)).toEqual({ kind: 'seek', to: 12 })
  })
})

describe('wantsVideo', () => {
  it('só conta com vídeo disponível e painel ou palco ligado', () => {
    expect(wantsVideo(false, true, true)).toBe(false)
    expect(wantsVideo(true, false, false)).toBe(false)
    expect(wantsVideo(true, true, false)).toBe(true)
    expect(wantsVideo(true, false, true)).toBe(true)
  })
})
