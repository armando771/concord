import { describe, expect, it } from 'vitest'
import { LEVEL_SOUNDS, oncePerKey, peakVolume, SOUNDS } from './sounds'

const first = (name: keyof typeof SOUNDS): number => SOUNDS[name][0].freq
const last = (name: keyof typeof SOUNDS): number => SOUNDS[name][SOUNDS[name].length - 1].freq

describe('SOUNDS', () => {
  it('entrar sobe, sair desce (como no Discord)', () => {
    expect(last('join')).toBeGreaterThan(first('join'))
    expect(last('leave')).toBeLessThan(first('leave'))
    expect(last('userJoin')).toBeGreaterThan(first('userJoin'))
    expect(last('userLeave')).toBeLessThan(first('userLeave'))
  })

  it('mutar desce, desmutar sobe', () => {
    expect(last('mute')).toBeLessThan(first('mute'))
    expect(last('unmute')).toBeGreaterThan(first('unmute'))
    expect(last('deafen')).toBeLessThan(first('deafen'))
    expect(last('undeafen')).toBeGreaterThan(first('undeafen'))
  })

  it('mensagem e menção sobem e soam diferentes', () => {
    expect(last('message')).toBeGreaterThan(first('message'))
    expect(last('mention')).toBeGreaterThan(first('mention'))
    expect(SOUNDS.message).not.toEqual(SOUNDS.mention)
    expect(SOUNDS.message).toHaveLength(2)
  })

  it('os sons de interface são curtos (menos de meio segundo)', () => {
    for (const [name, notes] of Object.entries(SOUNDS)) {
      if (LEVEL_SOUNDS.includes(name as never)) continue
      const end = Math.max(...notes.map((n) => n.at + n.duration))
      expect(end).toBeLessThan(0.5)
    }
  })
})

describe('sons de subir de nível', () => {
  const end = (name: keyof typeof SOUNDS): number =>
    Math.max(...SOUNDS[name].map((n) => n.at + n.duration))

  it('sobem e ficam mais ricos conforme a faixa', () => {
    for (const name of LEVEL_SOUNDS) expect(last(name)).toBeGreaterThan(first(name))
    expect(SOUNDS.levelChimeRich.length).toBeGreaterThan(SOUNDS.levelChime.length)
    expect(SOUNDS.levelFanfare.length).toBeGreaterThan(SOUNDS.levelChimeRich.length)
    expect(end('levelFanfare')).toBeGreaterThan(end('levelChimeRich'))
    expect(end('levelChimeRich')).toBeGreaterThan(end('levelChime'))
  })

  it('cabem na celebração (fanfarra até ~2 s)', () => {
    expect(end('levelChime')).toBeLessThan(0.8)
    expect(end('levelFanfare')).toBeLessThanOrEqual(2)
  })

  it('ficam abaixo das vozes: nem somando notas passam de 0,8 do volume base', () => {
    for (const name of LEVEL_SOUNDS) {
      expect(peakVolume(SOUNDS[name])).toBeLessThanOrEqual(0.8)
      expect(peakVolume(SOUNDS[name])).toBeGreaterThan(0)
    }
  })

  it('peakVolume soma as notas que tocam juntas', () => {
    expect(peakVolume(SOUNDS.join)).toBe(1)
    expect(
      peakVolume([
        { freq: 1, at: 0, duration: 1, volume: 0.3 },
        { freq: 2, at: 0.5, duration: 1, volume: 0.4 },
        { freq: 3, at: 2, duration: 1, volume: 0.6 }
      ])
    ).toBeCloseTo(0.7)
  })
})

describe('oncePerKey', () => {
  it('roda uma vez por chave (StrictMode monta efeitos duas vezes em dev)', () => {
    const first = oncePerKey()
    expect(first(1)).toBe(true)
    expect(first(1)).toBe(false)
    expect(first(2)).toBe(true)
    expect(first(2)).toBe(false)
  })
})
