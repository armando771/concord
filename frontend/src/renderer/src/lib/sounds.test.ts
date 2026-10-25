import { describe, expect, it } from 'vitest'
import { BASE_VOLUME, noteVolume, SOUNDS, type SoundName } from './sounds'

const first = (name: keyof typeof SOUNDS): number => SOUNDS[name][0].freq
const last = (name: keyof typeof SOUNDS): number => SOUNDS[name][SOUNDS[name].length - 1].freq

/** Maior soma de ganhos de notas tocando ao mesmo tempo. */
const peakGain = (name: SoundName): number =>
  Math.max(
    ...SOUNDS[name].map((n) =>
      SOUNDS[name]
        .filter((o) => o.at <= n.at && n.at < o.at + o.duration)
        .reduce((sum, o) => sum + noteVolume(o), 0)
    )
  )
const names = Object.keys(SOUNDS) as SoundName[]

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

  it('todos os sons são curtos (menos de meio segundo)', () => {
    for (const notes of Object.values(SOUNDS)) {
      const end = Math.max(...notes.map((n) => n.at + n.duration))
      expect(end).toBeLessThan(0.5)
    }
  })

  it('alguém entrando na call é bem mais alto que os outros sons, sem estourar', () => {
    for (const name of names.filter((n) => n !== 'userJoin')) {
      expect(peakGain('userJoin')).toBeGreaterThan(peakGain(name))
    }
    expect(peakGain('userJoin')).toBeGreaterThanOrEqual(BASE_VOLUME * 3)
    for (const name of names) expect(peakGain(name)).toBeLessThanOrEqual(0.5)
  })

  it('alguém entrando: três notas subindo em no máximo 0,35 s', () => {
    const notes = SOUNDS.userJoin
    expect(notes).toHaveLength(3)
    expect(notes[1].freq).toBeGreaterThan(notes[0].freq)
    expect(notes[2].freq).toBeGreaterThan(notes[1].freq)
    expect(Math.max(...notes.map((n) => n.at + n.duration))).toBeLessThanOrEqual(0.35)
  })

  it('os outros sons continuam no volume de antes', () => {
    for (const name of names.filter((n) => n !== 'userJoin')) {
      for (const note of SOUNDS[name]) expect(noteVolume(note)).toBe(0.12)
    }
  })
})
