import { describe, expect, it } from 'vitest'
import { SOUNDS } from './sounds'

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

  it('todos os sons são curtos (menos de meio segundo)', () => {
    for (const notes of Object.values(SOUNDS)) {
      const end = Math.max(...notes.map((n) => n.at + n.duration))
      expect(end).toBeLessThan(0.5)
    }
  })
})
