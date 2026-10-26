import { describe, expect, it } from 'vitest'
import {
  launchedHidden,
  shouldHideOnClose,
  notifyPlan,
  staleLoginItem,
  parseTitleBarColors,
  TITLE_BAR_COLOR,
  TITLE_BAR_SYMBOL_COLOR,
  titleBarOptions
} from './windowPolicy'

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

  it('com a janela fora de vista: toast e barra de tarefas', () => {
    const all = { toast: true, taskbar: true }
    expect(notifyPlan({ visible: false, focused: false })).toEqual(all)
    expect(notifyPlan({ visible: true, focused: false })).toEqual(all)
    expect(notifyPlan({ visible: false, focused: false }, { elsewhere: true })).toEqual(all)
  })

  it('com a janela em foco e a conversa aberta: nada', () => {
    expect(notifyPlan({ visible: true, focused: true })).toEqual({ toast: false, taskbar: false })
    expect(notifyPlan({ visible: true, focused: true }, { elsewhere: false })).toEqual({
      toast: false,
      taskbar: false
    })
  })

  it('com a janela em foco mas em outro chat: só o toast (sem piscar nem selo)', () => {
    expect(notifyPlan({ visible: true, focused: true }, { elsewhere: true })).toEqual({
      toast: true,
      taskbar: false
    })
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

describe('titleBarOptions', () => {
  it('no Windows esconde a moldura clara e pinta os botões com a cor do app', () => {
    expect(titleBarOptions('win32')).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: TITLE_BAR_COLOR, symbolColor: TITLE_BAR_SYMBOL_COLOR, height: 32 }
    })
    // Discord Escuro, o tema padrão (--bg-app e --interactive-normal).
    expect(TITLE_BAR_COLOR).toBe('#2c2d32')
    expect(TITLE_BAR_SYMBOL_COLOR).toBe('#c5c6ca')
    expect(titleBarOptions('linux').titleBarStyle).toBe('hidden')
  })

  it('no macOS mantém a barra nativa', () => {
    expect(titleBarOptions('darwin')).toEqual({})
  })
})

describe('parseTitleBarColors', () => {
  it('aceita duas cores hex de 6 dígitos (o tema trocou)', () => {
    expect(parseTitleBarColors({ color: '#FFFFFF', symbolColor: '#28282d' })).toEqual({
      color: '#ffffff',
      symbolColor: '#28282d'
    })
  })

  it('recusa o que não for hex opaco (vem do renderer)', () => {
    expect(parseTitleBarColors(null)).toBeNull()
    expect(parseTitleBarColors('#fff')).toBeNull()
    expect(parseTitleBarColors({ color: 'red', symbolColor: '#000000' })).toBeNull()
    expect(parseTitleBarColors({ color: '#000000', symbolColor: 'rgba(0,0,0,0.5)' })).toBeNull()
    expect(parseTitleBarColors({ color: '#00000080', symbolColor: '#000000' })).toBeNull()
  })
})
