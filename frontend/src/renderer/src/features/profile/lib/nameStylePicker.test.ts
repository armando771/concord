import { describe, expect, it } from 'vitest'
import { withEffect } from './nameStylePicker'

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
