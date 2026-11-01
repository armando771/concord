import { describe, expect, it } from 'vitest'
import { effectiveBindings, globalBindingList, sanitizeKeybindPrefs } from './keybindPrefs'
import { defaultBindings } from './shortcuts'

describe('effectiveBindings', () => {
  it('sem mudanças são os de fábrica', () => {
    expect(effectiveBindings({})).toEqual(defaultBindings())
  })

  it('mudança troca; null tira o atalho', () => {
    const map = effectiveBindings({ toggleMute: 'Mouse3', toggleDeafen: null })
    expect(map.toggleMute).toBe('Mouse3')
    expect(map.toggleDeafen).toBeNull()
    expect(map.quickSwitcher).toBe('Ctrl+K')
  })
})

describe('sanitizeKeybindPrefs', () => {
  it('lixo vira preferências vazias', () => {
    for (const raw of [null, undefined, 3, 'x', []]) {
      expect(sanitizeKeybindPrefs(raw)).toEqual({ overrides: {}, global: {} })
    }
  })

  it('mantém o válido e descarta ação desconhecida e atalho inválido', () => {
    const prefs = sanitizeKeybindPrefs({
      overrides: {
        toggleMute: 'Mouse3',
        toggleDeafen: null,
        quickSwitcher: 'Shift+K',
        inexistente: 'Ctrl+J',
        prevChannel: 42
      },
      global: { toggleMute: true, toggleDeafen: false, quickSwitcher: true, inexistente: true }
    })
    expect(prefs.overrides).toEqual({ toggleMute: 'Mouse3', toggleDeafen: null })
    expect(prefs.global).toEqual({ toggleMute: true })
  })
})

describe('globalBindingList', () => {
  it('só ações de voz ligadas e com atalho', () => {
    const bindings = effectiveBindings({ toggleDeafen: null })
    expect(globalBindingList(bindings, { toggleMute: true, toggleDeafen: true })).toEqual([
      { id: 'toggleMute', binding: 'Ctrl+Shift+M' }
    ])
    expect(globalBindingList(bindings, {})).toEqual([])
  })

  it('manda o atalho de mouse também', () => {
    const bindings = effectiveBindings({ toggleMute: 'Mouse3' })
    expect(globalBindingList(bindings, { toggleMute: true })).toEqual([
      { id: 'toggleMute', binding: 'Mouse3' }
    ])
  })
})
