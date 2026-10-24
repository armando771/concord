import { describe, expect, it } from 'vitest'
import { launchedHidden, shouldHideOnClose, shouldNotify, staleLoginItem } from './windowPolicy'

describe('windowPolicy', () => {
  it('no Windows, fechar a janela esconde na bandeja', () => {
    expect(shouldHideOnClose('win32', false)).toBe(true)
  })

  it('"Sair" de verdade fecha mesmo no Windows', () => {
    expect(shouldHideOnClose('win32', true)).toBe(false)
  })

  it('fora do Windows, fechar continua fechando', () => {
    expect(shouldHideOnClose('linux', false)).toBe(false)
    expect(shouldHideOnClose('darwin', false)).toBe(false)
  })

  it('inicia escondido quando aberto pelo login do Windows', () => {
    expect(launchedHidden(['Salinha.exe', '--hidden'])).toBe(true)
    expect(launchedHidden(['Salinha.exe'])).toBe(false)
  })

  it('notifica só quando a janela não está à vista', () => {
    expect(shouldNotify({ visible: false, focused: false })).toBe(true)
    expect(shouldNotify({ visible: true, focused: false })).toBe(true)
    expect(shouldNotify({ visible: true, focused: true })).toBe(false)
  })

  describe('staleLoginItem (app renomeado de Concord para Salinha)', () => {
    const exe = 'C:\\Users\\ana\\AppData\\Local\\Programs\\concord\\Salinha.exe'
    const old = {
      path: 'C:\\Users\\ana\\AppData\\Local\\Programs\\concord\\Concord.exe',
      enabled: true
    }

    it('acha o atalho de login que ainda aponta para o .exe antigo da mesma pasta', () => {
      expect(staleLoginItem([old], exe)).toBe(old)
    })

    it('ignora maiúsculas/minúsculas no caminho, como o Windows', () => {
      expect(staleLoginItem([old], exe.toUpperCase())).toBe(old)
    })

    it('atalho já no .exe atual não precisa de conserto', () => {
      expect(staleLoginItem([{ path: exe, enabled: true }], exe)).toBeUndefined()
    })

    it('não mexe em atalhos de outros programas', () => {
      expect(
        staleLoginItem([{ path: 'C:\\Program Files\\Steam\\steam.exe', enabled: true }], exe)
      ).toBeUndefined()
    })
  })
})
