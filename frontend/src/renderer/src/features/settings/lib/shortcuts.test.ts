import { describe, expect, it } from 'vitest'
import { isValidBinding } from './keybinds'
import {
  SHORTCUTS,
  actionForBinding,
  defaultBindings,
  findConflict,
  type BindingMap
} from './shortcuts'

describe('atalhos padrão', () => {
  it('todos são atalhos válidos e nenhum se repete', () => {
    const seen = new Set<string>()
    for (const { defaultBinding } of SHORTCUTS) {
      expect(isValidBinding(defaultBinding)).toBe(true)
      expect(seen.has(defaultBinding)).toBe(false)
      seen.add(defaultBinding)
    }
  })

  it('só voz pode ser global', () => {
    expect(SHORTCUTS.filter((s) => s.canBeGlobal).map((s) => s.id)).toEqual([
      'toggleMute',
      'toggleDeafen'
    ])
  })
})

describe('actionForBinding', () => {
  it('acha a ação pelo atalho', () => {
    const map = defaultBindings()
    expect(actionForBinding('Ctrl+K', map)?.id).toBe('quickSwitcher')
    expect(actionForBinding('Ctrl+Alt+Shift+Down', map)?.id).toBe('nextUnreadServer')
    expect(actionForBinding('Ctrl+Shift+M', map)?.id).toBe('toggleMute')
    expect(actionForBinding('Ctrl+J', map)).toBeNull()
  })

  it('usa o atalho trocado e esquece o de fábrica', () => {
    const map: BindingMap = { ...defaultBindings(), toggleMute: 'Mouse3' }
    expect(actionForBinding('Mouse3', map)?.id).toBe('toggleMute')
    expect(actionForBinding('Ctrl+Shift+M', map)).toBeNull()
  })

  it('ação sem atalho não responde a nada', () => {
    const map: BindingMap = { ...defaultBindings(), toggleMute: null }
    expect(actionForBinding('', map)).toBeNull()
  })
})

describe('findConflict', () => {
  it('avisa quando outra ação já usa o atalho', () => {
    expect(findConflict('toggleMute', 'Ctrl+K', defaultBindings())?.id).toBe('quickSwitcher')
  })

  it('o atalho da própria ação não é conflito', () => {
    expect(findConflict('toggleMute', 'Ctrl+Shift+M', defaultBindings())).toBeNull()
  })

  it('atalho livre não tem conflito', () => {
    expect(findConflict('toggleMute', 'Mouse4', defaultBindings())).toBeNull()
  })
})
