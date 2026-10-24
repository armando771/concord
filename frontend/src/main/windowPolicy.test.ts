import { describe, expect, it } from 'vitest'
import { launchedHidden, shouldHideOnClose, shouldNotify } from './windowPolicy'

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
    expect(launchedHidden(['Concord.exe', '--hidden'])).toBe(true)
    expect(launchedHidden(['Concord.exe'])).toBe(false)
  })

  it('notifica só quando a janela não está à vista', () => {
    expect(shouldNotify({ visible: false, focused: false })).toBe(true)
    expect(shouldNotify({ visible: true, focused: false })).toBe(true)
    expect(shouldNotify({ visible: true, focused: true })).toBe(false)
  })
})
