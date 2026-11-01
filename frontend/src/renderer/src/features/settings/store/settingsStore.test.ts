import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from './settingsStore'

beforeEach(() => {
  useSettingsStore.setState({ open: false, section: 'account', dirty: false, blockedAt: 0 })
})

describe('settingsStore', () => {
  it('abre direto na seção pedida', () => {
    useSettingsStore.getState().openSettings('profiles')
    expect(useSettingsStore.getState()).toMatchObject({ open: true, section: 'profiles' })
  })

  it('sem alterações, troca de seção e fecha', () => {
    useSettingsStore.getState().openSettings()
    useSettingsStore.getState().goTo('voice')
    expect(useSettingsStore.getState().section).toBe('voice')
    useSettingsStore.getState().close()
    expect(useSettingsStore.getState().open).toBe(false)
  })

  it('com alterações não salvas, não sai e faz a barra tremer', () => {
    useSettingsStore.getState().openSettings('profiles')
    useSettingsStore.getState().setDirty(true)

    useSettingsStore.getState().goTo('voice')
    expect(useSettingsStore.getState().section).toBe('profiles')
    expect(useSettingsStore.getState().blockedAt).toBeGreaterThan(0)

    useSettingsStore.getState().close()
    expect(useSettingsStore.getState().open).toBe(true)
  })

  it('sair da conta fecha mesmo com alterações', () => {
    useSettingsStore.getState().openSettings('profiles')
    useSettingsStore.getState().setDirty(true)
    useSettingsStore.getState().forceClose()
    expect(useSettingsStore.getState()).toMatchObject({ open: false, dirty: false })
  })
})
