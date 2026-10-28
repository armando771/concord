import { describe, expect, it } from 'vitest'
import {
  settingsMobileStart,
  settingsMobileView,
  settingsShellClasses,
  tappedCurrentSection,
  type SettingsMobileState
} from './settingsMobileView'

describe('settingsMobileView', () => {
  const start = settingsMobileStart('account')

  it('abre na lista de seções', () => {
    expect(start).toEqual({ view: 'list', key: 'account' })
  })

  it('escolher outra seção abre o detalhe dela', () => {
    expect(settingsMobileView(start, { type: 'section', key: 'privacy' })).toEqual({
      view: 'detail',
      key: 'privacy'
    })
  })

  it('a mesma seção (re-render) não muda nada', () => {
    expect(settingsMobileView(start, { type: 'section', key: 'account' })).toBe(start)
  })

  it('tocar de novo na seção atual (já marcada) também abre o detalhe', () => {
    expect(settingsMobileView(start, { type: 'pickCurrent' }).view).toBe('detail')
  })

  it('voltar mostra a lista e guarda a seção', () => {
    const detail: SettingsMobileState = { view: 'detail', key: 'privacy' }
    expect(settingsMobileView(detail, { type: 'back' })).toEqual({ view: 'list', key: 'privacy' })
  })
})

describe('settingsShellClasses', () => {
  it('na lista, a seção some só no celular', () => {
    expect(settingsShellClasses('list')).toEqual({
      nav: 'max-md:min-h-0 max-md:flex-1',
      main: 'max-md:hidden'
    })
  })

  it('no detalhe, a lista some só no celular', () => {
    expect(settingsShellClasses('detail')).toEqual({ nav: 'max-md:hidden', main: '' })
  })
})

describe('tappedCurrentSection', () => {
  const el = (current: boolean) => ({
    closest: (sel: string) => (current && sel === '[aria-current="page"]' ? {} : null)
  })

  it('reconhece o item marcado (ou algo dentro dele)', () => {
    expect(tappedCurrentSection(el(true) as unknown as EventTarget)).toBe(true)
    expect(tappedCurrentSection(el(false) as unknown as EventTarget)).toBe(false)
    expect(tappedCurrentSection(null)).toBe(false)
  })
})
