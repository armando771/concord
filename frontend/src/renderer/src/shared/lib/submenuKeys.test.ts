import { describe, expect, it } from 'vitest'
import { opensSubmenu, submenuKeyAction } from './submenuKeys'

describe('opensSubmenu', () => {
  it('abre com a seta para a direita', () => {
    expect(opensSubmenu('ArrowRight')).toBe(true)
    expect(opensSubmenu('ArrowDown')).toBe(false)
  })
})

describe('submenuKeyAction', () => {
  it('Esc e seta para a esquerda fecham e voltam o foco ao item pai', () => {
    expect(submenuKeyAction('Escape', 0, 3)).toBe('close')
    expect(submenuKeyAction('ArrowLeft', 2, 3)).toBe('close')
  })
  it('setas, Home e End dizem qual item focar', () => {
    expect(submenuKeyAction('ArrowDown', 0, 3)).toBe(1)
    expect(submenuKeyAction('ArrowUp', 0, 3)).toBe(2)
    expect(submenuKeyAction('Home', 2, 3)).toBe(0)
    expect(submenuKeyAction('End', 0, 3)).toBe(2)
  })
  it('ignora as outras teclas', () => {
    expect(submenuKeyAction('a', 0, 3)).toBeNull()
    expect(submenuKeyAction('Enter', 0, 3)).toBeNull()
  })
})
