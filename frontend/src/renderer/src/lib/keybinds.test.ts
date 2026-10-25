import { describe, expect, it } from 'vitest'
import {
  bindingFromKeyEvent,
  bindingFromMouseButton,
  bindingLabels,
  isMouseBinding,
  isValidBinding,
  mouseButtonFromHook,
  mouseButtonOf,
  toElectronAccelerator,
  type KeyEventLike
} from './keybinds'

const ev = (key: string, mods: Partial<Omit<KeyEventLike, 'key'>> = {}): KeyEventLike => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods
})

describe('bindingFromKeyEvent', () => {
  it('monta o atalho com os modificadores sempre na mesma ordem', () => {
    expect(bindingFromKeyEvent(ev('K', { ctrlKey: true }))).toBe('Ctrl+K')
    expect(bindingFromKeyEvent(ev('M', { shiftKey: true, ctrlKey: true }))).toBe('Ctrl+Shift+M')
    expect(
      bindingFromKeyEvent(ev('ArrowDown', { shiftKey: true, altKey: true, ctrlKey: true }))
    ).toBe('Ctrl+Alt+Shift+Down')
  })

  it('Cmd conta como Ctrl', () => {
    expect(bindingFromKeyEvent(ev('k', { metaKey: true }))).toBe('Ctrl+K')
  })

  it('pontuação vale pelo caractere (funciona em qualquer layout)', () => {
    expect(bindingFromKeyEvent(ev('/', { ctrlKey: true }))).toBe('Ctrl+/')
    expect(bindingFromKeyEvent(ev(',', { ctrlKey: true }))).toBe('Ctrl+,')
  })

  it('teclas F valem sozinhas; letra sozinha não', () => {
    expect(bindingFromKeyEvent(ev('F9'))).toBe('F9')
    expect(bindingFromKeyEvent(ev('m'))).toBeNull()
    expect(bindingFromKeyEvent(ev('ArrowUp'))).toBeNull()
  })

  it('Shift sozinho só com teclas que não digitam', () => {
    expect(bindingFromKeyEvent(ev('M', { shiftKey: true }))).toBeNull()
    expect(bindingFromKeyEvent(ev('ArrowUp', { shiftKey: true }))).toBe('Shift+Up')
    expect(bindingFromKeyEvent(ev('Tab', { shiftKey: true }))).toBe('Shift+Tab')
  })

  it('Esc, modificadores soltos e teclas estranhas não viram atalho', () => {
    expect(bindingFromKeyEvent(ev('Escape', { ctrlKey: true }))).toBeNull()
    expect(bindingFromKeyEvent(ev('Control', { ctrlKey: true }))).toBeNull()
    expect(bindingFromKeyEvent(ev('Dead', { ctrlKey: true }))).toBeNull()
    expect(bindingFromKeyEvent(ev('F25'))).toBeNull()
  })
})

describe('botões do mouse', () => {
  it('meio e laterais viram atalho; esquerdo e direito não', () => {
    expect(bindingFromMouseButton(1)).toBe('Mouse1')
    expect(bindingFromMouseButton(3)).toBe('Mouse3')
    expect(bindingFromMouseButton(4)).toBe('Mouse4')
    expect(bindingFromMouseButton(0)).toBeNull()
    expect(bindingFromMouseButton(2)).toBeNull()
    expect(bindingFromMouseButton(-1)).toBeNull()
    expect(bindingFromMouseButton(1.5)).toBeNull()
  })

  it('reconhece atalho de mouse e o número do botão', () => {
    expect(isMouseBinding('Mouse3')).toBe(true)
    expect(mouseButtonOf('Mouse3')).toBe(3)
    expect(isMouseBinding('Ctrl+K')).toBe(false)
    expect(mouseButtonOf('Mouse2')).toBeNull()
    expect(mouseButtonOf('Mouse0')).toBeNull()
  })

  it('botão do hook global → botão do DOM', () => {
    expect(mouseButtonFromHook(1)).toBeNull()
    expect(mouseButtonFromHook(2)).toBeNull()
    expect(mouseButtonFromHook(3)).toBe(1)
    expect(mouseButtonFromHook(4)).toBe(3)
    expect(mouseButtonFromHook(5)).toBe(4)
    expect(mouseButtonFromHook(6)).toBe(5)
    expect(mouseButtonFromHook(Number.NaN)).toBeNull()
  })
})

describe('isValidBinding', () => {
  it('aceita o que os gravadores geram', () => {
    for (const ok of [
      'Ctrl+K',
      'Ctrl+Alt+Shift+Down',
      'F12',
      'Alt+Up',
      'Shift+Tab',
      'Mouse1',
      'Mouse4',
      'Ctrl+/'
    ]) {
      expect(isValidBinding(ok)).toBe(true)
    }
  })

  it('recusa lixo, modificadores fora de ordem e regras quebradas', () => {
    for (const bad of [
      '',
      'K',
      'Shift+K',
      'Shift+Ctrl+K',
      'Ctrl+Ctrl+K',
      'Ctrl+',
      'Ctrl+Escape',
      'Mouse0',
      'Mouse2',
      'F25',
      'ctrl+k'
    ]) {
      expect(isValidBinding(bad)).toBe(false)
    }
    expect(isValidBinding(42)).toBe(false)
    expect(isValidBinding(null)).toBe(false)
  })
})

describe('bindingLabels', () => {
  it('Windows: nomes; macOS: símbolos; setas viram setas', () => {
    expect(bindingLabels('Ctrl+Alt+Shift+Down', false)).toEqual(['Ctrl', 'Alt', 'Shift', '↓'])
    expect(bindingLabels('Ctrl+Alt+Shift+Down', true)).toEqual(['⌘', '⌥', '⇧', '↓'])
    expect(bindingLabels('Alt+Up', false)).toEqual(['Alt', '↑'])
  })

  it('botões do mouse têm nome em português', () => {
    expect(bindingLabels('Mouse1', false)).toEqual(['Botão do meio'])
    expect(bindingLabels('Mouse3', false)).toEqual(['Botão lateral 1'])
    expect(bindingLabels('Mouse4', false)).toEqual(['Botão lateral 2'])
    expect(bindingLabels('Mouse5', false)).toEqual(['Botão 6'])
  })
})

describe('toElectronAccelerator', () => {
  it('Ctrl vira CommandOrControl; o resto fica igual', () => {
    expect(toElectronAccelerator('Ctrl+Shift+M')).toBe('CommandOrControl+Shift+M')
    expect(toElectronAccelerator('F9')).toBe('F9')
    expect(toElectronAccelerator('Alt+Up')).toBe('Alt+Up')
  })

  it('mouse não tem accelerator', () => {
    expect(toElectronAccelerator('Mouse3')).toBeNull()
  })
})
