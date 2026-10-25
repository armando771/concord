import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTIFICATION_PREFS } from './notifications'
import { STATUS_META, isChosenStatus, prefsForStatus, presenceStatusOf } from './presenceStatus'

describe('STATUS_META', () => {
  it('usa as cores do Discord', () => {
    expect(STATUS_META.online.color).toBe('#23a55a')
    expect(STATUS_META.idle.color).toBe('#f0b232')
    expect(STATUS_META.dnd.color).toBe('#f23f43')
    expect(STATUS_META.invisible.color).toBe(STATUS_META.offline.color)
  })

  it('tem os nomes em português', () => {
    expect(STATUS_META.idle.label).toBe('Ausente')
    expect(STATUS_META.dnd.label).toBe('Não perturbe')
  })
})

describe('presenceStatusOf', () => {
  it('usa o status do backend', () => {
    expect(presenceStatusOf('dnd', true)).toBe('dnd')
    expect(presenceStatusOf('offline', false)).toBe('offline')
  })

  it('sem status (backend antigo) cai no online/offline', () => {
    expect(presenceStatusOf(undefined, true)).toBe('online')
    expect(presenceStatusOf(undefined, false)).toBe('offline')
    expect(presenceStatusOf('qualquer', true)).toBe('online')
  })
})

describe('isChosenStatus', () => {
  it('offline não é escolha', () => {
    expect(isChosenStatus('invisible')).toBe(true)
    expect(isChosenStatus('offline')).toBe(false)
  })
})

describe('prefsForStatus', () => {
  it('"Não perturbe" silencia tudo', () => {
    expect(prefsForStatus(DEFAULT_NOTIFICATION_PREFS, 'dnd')).toEqual({
      desktop: false,
      taskbar: false,
      sound: false
    })
  })

  it('nos outros status respeita as preferências', () => {
    const prefs = { desktop: true, taskbar: false, sound: true }
    expect(prefsForStatus(prefs, 'idle')).toBe(prefs)
    expect(prefsForStatus(prefs, 'invisible')).toBe(prefs)
    expect(prefsForStatus(prefs, undefined)).toBe(prefs)
  })
})
