import { describe, expect, it } from 'vitest'
import {
  createVoiceActivityState,
  mergeLocalSpeaking,
  rmsDb,
  sameIds,
  stepVoiceActivity,
  type VoiceActivityConfig
} from './voiceActivity'

const CONFIG: VoiceActivityConfig = { onDb: -40, offDb: -46, attackMs: 0, hangoverMs: 300 }
const LOUD = -20
const QUIET = -70
/** Uma janela de análise (~32 ms, ~31 Hz). */
const FRAME = 32

/** Passa uma sequência de níveis, um por janela, e devolve o resultado de cada uma. */
function run(levels: number[], config = CONFIG): boolean[] {
  const state = createVoiceActivityState()
  return levels.map((level, i) => stepVoiceActivity(state, level, i * FRAME, config))
}

describe('stepVoiceActivity', () => {
  it('silêncio não é fala', () => {
    expect(run([QUIET, QUIET, QUIET])).toEqual([false, false, false])
  })

  it('sem attack, acende já na primeira janela com voz', () => {
    expect(run([QUIET, LOUD])).toEqual([false, true])
  })

  it('com attack, só acende depois de ficar acima do limiar por esse tempo', () => {
    const config = { ...CONFIG, attackMs: 50 }
    // 0 ms, 32 ms (ainda não), 64 ms (passou dos 50 ms)
    expect(run([LOUD, LOUD, LOUD], config)).toEqual([false, false, true])
  })

  it('um estalo isolado mais curto que o attack não acende', () => {
    const config = { ...CONFIG, attackMs: 50 }
    expect(run([LOUD, QUIET, LOUD, QUIET], config)).toEqual([false, false, false, false])
  })

  it('segura o anel entre palavras (hangover) e apaga depois do silêncio', () => {
    // fala até 32 ms; silêncio a partir de 64 ms; 300 ms depois de 32 ms = 332 ms
    const levels = [LOUD, LOUD, ...Array(10).fill(QUIET)]
    const out = run(levels)
    const offAt = out.indexOf(false, 1)
    expect(out.slice(0, offAt).every(Boolean)).toBe(true)
    // última janela com voz em 32 ms: apaga na primeira janela >= 332 ms (352 ms)
    expect(offAt * FRAME).toBe(352)
  })

  it('pausa curta no meio da frase não pisca', () => {
    const levels = [LOUD, QUIET, QUIET, QUIET, LOUD, QUIET, QUIET, LOUD]
    expect(run(levels).every(Boolean)).toBe(true)
  })

  it('histerese: já falando, nível entre os dois limiares continua sendo fala', () => {
    const between = -43
    const out = run([LOUD, between, between, ...Array(12).fill(between)])
    expect(out.every(Boolean)).toBe(true)
  })

  it('histerese: sem estar falando, nível entre os limiares não acende', () => {
    expect(run([-43, -43, -43])).toEqual([false, false, false])
  })

  it('o hangover conta a partir da última janela com voz, não da primeira', () => {
    const levels = [...Array(20).fill(LOUD), ...Array(5).fill(QUIET)]
    // 20 janelas de fala = 640 ms; 5 janelas de silêncio (160 ms) < 300 ms
    expect(run(levels).every(Boolean)).toBe(true)
  })
})

describe('rmsDb', () => {
  it('converte soma dos quadrados em dBFS', () => {
    // seno de amplitude 1: RMS = 1/√2 ≈ -3 dBFS
    expect(rmsDb(0.5 * 100, 100)).toBeCloseTo(-3.01, 1)
    expect(rmsDb(0.01 * 0.01 * 10, 10)).toBeCloseTo(-40, 5)
  })

  it('silêncio absoluto e janela vazia viram um piso finito', () => {
    expect(rmsDb(0, 128)).toBe(-120)
    expect(rmsDb(0, 0)).toBe(-120)
  })
})

describe('mergeLocalSpeaking', () => {
  it('sem detecção local, usa o que o servidor disse (inclusive sobre mim)', () => {
    expect(mergeLocalSpeaking(['me', 'a'], 'me', null)).toEqual(['me', 'a'])
  })

  it('a detecção local manda no próprio usuário: acende antes do servidor', () => {
    expect(mergeLocalSpeaking(['a'], 'me', true)).toEqual(['a', 'me'])
  })

  it('a detecção local manda no próprio usuário: o servidor atrasado não segura o anel', () => {
    expect(mergeLocalSpeaking(['me', 'a'], 'me', false)).toEqual(['a'])
  })

  it('os outros continuam vindo só do servidor', () => {
    expect(mergeLocalSpeaking(['a', 'b'], 'me', false)).toEqual(['a', 'b'])
    expect(mergeLocalSpeaking([], 'me', true)).toEqual(['me'])
  })

  it('sem usuário logado, não mexe na lista', () => {
    expect(mergeLocalSpeaking(['a'], null, true)).toEqual(['a'])
  })
})

describe('sameIds', () => {
  it('compara elemento a elemento', () => {
    expect(sameIds(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(false)
    expect(sameIds(['a'], ['a', 'b'])).toBe(false)
    expect(sameIds([], [])).toBe(true)
  })
})
