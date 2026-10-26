import { describe, expect, it } from 'vitest'
import {
  closeToTrayEnabled,
  launchedHidden,
  shouldHideOnClose,
  trayHostRegistered,
  trayTooltip,
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

  it('no macOS, fechar continua fechando', () => {
    expect(shouldHideOnClose('darwin', false)).toBe(false)
  })

  it('no Linux, sem bandeja confirmada fechar fecha (nunca fica invisível)', () => {
    expect(shouldHideOnClose('linux', false)).toBe(false)
    expect(shouldHideOnClose('linux', false, { trayWorks: false, enabled: true })).toBe(false)
  })

  it('no Linux, com bandeja funcionando e a opção ligada, fechar esconde', () => {
    expect(shouldHideOnClose('linux', false, { trayWorks: true, enabled: true })).toBe(true)
  })

  it('no Linux, opção desligada ou "Sair" fecham de verdade', () => {
    expect(shouldHideOnClose('linux', false, { trayWorks: true, enabled: false })).toBe(false)
    expect(shouldHideOnClose('linux', true, { trayWorks: true, enabled: true })).toBe(false)
  })

  it('no Windows a opção da bandeja não muda nada', () => {
    expect(shouldHideOnClose('win32', false, { trayWorks: false, enabled: false })).toBe(true)
  })

  it('"Minimizar para a bandeja ao fechar" vem ligada se nunca foi mexida', () => {
    expect(closeToTrayEnabled(undefined)).toBe(true)
    expect(closeToTrayEnabled(true)).toBe(true)
    expect(closeToTrayEnabled(false)).toBe(false)
    expect(closeToTrayEnabled('nao')).toBe(true)
  })

  it('lê se há um host de bandeja (StatusNotifierHost) na resposta do D-Bus', () => {
    // dbus-send, gdbus e busctl
    expect(
      trayHostRegistered('method return time=1 sender=:1.11\n   variant       boolean true\n')
    ).toBe(true)
    expect(trayHostRegistered('(<true>,)\n')).toBe(true)
    expect(trayHostRegistered('b true\n')).toBe(true)
    expect(trayHostRegistered('   variant       boolean false\n')).toBe(false)
    expect(trayHostRegistered('(<false>,)')).toBe(false)
    expect(trayHostRegistered('')).toBe(false)
    expect(trayHostRegistered('Error org.freedesktop.DBus.Error.ServiceUnknown')).toBe(false)
  })

  it('dica da bandeja: chamada e não lidas', () => {
    expect(trayTooltip(false, 0)).toBe('Salinha')
    expect(trayTooltip(true, 0)).toBe('Salinha — em chamada')
    expect(trayTooltip(false, 1)).toBe('Salinha — 1 não lida')
    expect(trayTooltip(false, 3)).toBe('Salinha — 3 não lidas')
    expect(trayTooltip(true, 3)).toBe('Salinha — em chamada · 3 não lidas')
    expect(trayTooltip(false, 250)).toBe('Salinha — 99+ não lidas')
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
    expect(TITLE_BAR_COLOR).toBe('#121214')
    expect(TITLE_BAR_SYMBOL_COLOR).toBe('#96979e')
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
