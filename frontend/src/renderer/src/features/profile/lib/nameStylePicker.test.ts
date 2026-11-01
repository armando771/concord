import { describe, expect, it } from 'vitest'
import { DEFAULT_NAME_STYLE, NAME_EFFECTS, NAME_FONTS, resolveNameStyle } from './nameStyle'
import { surpriseNameStyle, withEffect } from './nameStylePicker'

describe('withEffect', () => {
  it('efeito desconhecido não muda nada', () => {
    const style = { font: 'tempo', effect: 'solid', colors: ['#111111'] }
    expect(withEffect(style, 'nao-existe')).toBe(style)
  })
  it('mantém as cores que servem e completa as que faltam', () => {
    expect(withEffect({ font: 'tempo', effect: 'solid', colors: ['#111111'] }, 'gradient')).toEqual({
      font: 'tempo',
      effect: 'gradient',
      colors: ['#111111', '#eb459e']
    })
  })
  it('corta as cores que o efeito não usa', () => {
    expect(withEffect({ font: 'default', effect: 'gradient', colors: ['#111111', '#222222'] }, 'rainbow').colors).toEqual([])
  })
})

describe('surpriseNameStyle', () => {
  // Gerador previsível: devolve os números em sequência (e repete).
  const seq = (...values: number[]): (() => number) => {
    let i = 0
    return () => values[i++ % values.length]
  }

  it('sorteia fonte, efeito e as cores que o efeito usa', () => {
    const style = surpriseNameStyle(DEFAULT_NAME_STYLE, seq(0.99, 0.1, 0.5, 0.2))
    expect(NAME_FONTS.some((f) => f.id === style.font)).toBe(true)
    const effect = NAME_EFFECTS.find((e) => e.id === style.effect)!
    expect(style.colors.length).toBe(effect.maxColors)
    for (const c of style.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('nunca devolve o mesmo estilo de antes', () => {
    const same = surpriseNameStyle(DEFAULT_NAME_STYLE, seq(0))
    const again = surpriseNameStyle(same, seq(0))
    expect(again).not.toEqual(same)
  })

  it('o resultado já vem válido para salvar', () => {
    for (let i = 0; i < 50; i++) {
      const style = surpriseNameStyle(DEFAULT_NAME_STYLE)
      expect(resolveNameStyle(style)).toEqual(style)
    }
  })
})
