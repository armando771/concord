import { describe, expect, it } from 'vitest'
import { composerFocusPlan, hasFinePointer, isTextField } from './composerFocus'

describe('composerFocusPlan', () => {
  const base = {
    room: 'channel:2',
    focusedRoom: 'channel:1',
    canSend: true,
    finePointer: true,
    typingElsewhere: false
  }

  it('abriu outro canal com mouse: foca o campo e marca a sala', () => {
    expect(composerFocusPlan(base)).toEqual({ focus: true, focusedRoom: 'channel:2' })
  })

  it('primeira sala aberta: foca', () => {
    expect(composerFocusPlan({ ...base, focusedRoom: null })).toEqual({
      focus: true,
      focusedRoom: 'channel:2'
    })
  })

  it('mesma sala de antes (ex.: só mudou a permissão): não foca de novo', () => {
    expect(composerFocusPlan({ ...base, focusedRoom: 'channel:2' })).toEqual({
      focus: false,
      focusedRoom: 'channel:2'
    })
  })

  it('sem permissão de enviar: não foca e a sala fica para quando puder', () => {
    expect(composerFocusPlan({ ...base, canSend: false })).toEqual({
      focus: false,
      focusedRoom: 'channel:1'
    })
  })

  it('tela de toque: não foca (abriria o teclado virtual)', () => {
    expect(composerFocusPlan({ ...base, finePointer: false })).toEqual({
      focus: false,
      focusedRoom: 'channel:2'
    })
  })

  it('digitando em outro campo: não rouba o foco', () => {
    expect(composerFocusPlan({ ...base, typingElsewhere: true })).toEqual({
      focus: false,
      focusedRoom: 'channel:2'
    })
  })
})

describe('hasFinePointer', () => {
  it('mouse ou trackpad como ponteiro principal', () => {
    const matchMedia = (q: string): { matches: boolean } => ({ matches: q === '(pointer: fine)' })
    expect(hasFinePointer({ matchMedia })).toBe(true)
  })

  it('toque como ponteiro principal', () => {
    expect(hasFinePointer({ matchMedia: () => ({ matches: false }) })).toBe(false)
  })

  it('sem matchMedia: trata como toque (não foca)', () => {
    expect(hasFinePointer({})).toBe(false)
  })
})

describe('isTextField', () => {
  it('campos onde se digita', () => {
    expect(isTextField({ tagName: 'INPUT' })).toBe(true)
    expect(isTextField({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTextField({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('botão, link ou nada focado', () => {
    expect(isTextField({ tagName: 'BUTTON' })).toBe(false)
    expect(isTextField({ tagName: 'A', isContentEditable: false })).toBe(false)
    expect(isTextField(null)).toBe(false)
  })
})
