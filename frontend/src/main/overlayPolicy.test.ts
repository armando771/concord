import { describe, expect, it } from 'vitest'
import {
  overlayBounds,
  overlayShortcuts,
  parseForegroundLine,
  shouldShowOverlay,
  shouldWatchForeground
} from './overlayPolicy'

describe('parseForegroundLine', () => {
  it('jogo cobrindo o monitor', () => {
    expect(parseForegroundLine('fullscreen 4242 0 0 1920 1080')).toEqual({
      pid: 4242,
      monitor: { x: 0, y: 0, width: 1920, height: 1080 }
    })
  })

  it('aceita \\r e monitor à esquerda do principal', () => {
    expect(parseForegroundLine('fullscreen 7 -1920 0 0 1080\r')).toEqual({
      pid: 7,
      monitor: { x: -1920, y: 0, width: 1920, height: 1080 }
    })
  })

  it('"none" = nada em tela cheia', () => {
    expect(parseForegroundLine('none')).toBeNull()
  })

  it('linhas estranhas são ignoradas', () => {
    for (const line of [
      '',
      'fullscreen abc 0 0 1 1',
      'fullscreen 1 0 0 0 0',
      'fullscreen 0 0 0 10 10',
      'erro em x',
      'fullscreen 1 0 0 10'
    ])
      expect(parseForegroundLine(line)).toBeUndefined()
  })
})

describe('shouldWatchForeground', () => {
  const on = { enabled: true, inCall: true }

  it('só no Windows, ligado e em call', () => {
    expect(shouldWatchForeground('win32', on)).toBe(true)
    expect(shouldWatchForeground('linux', on)).toBe(false)
    expect(shouldWatchForeground('win32', { enabled: false, inCall: true })).toBe(false)
    expect(shouldWatchForeground('win32', { enabled: true, inCall: false })).toBe(false)
    expect(shouldWatchForeground('win32', null)).toBe(false)
  })
})

describe('shouldShowOverlay', () => {
  const on = { enabled: true, inCall: true }
  const game = { pid: 4242, monitor: { x: 0, y: 0, width: 1920, height: 1080 } }

  it('outra app em tela cheia mostra', () => {
    expect(shouldShowOverlay('win32', on, game, 100)).toBe(true)
  })

  it('janela da própria Salinha não mostra', () => {
    expect(shouldShowOverlay('win32', on, { ...game, pid: 100 }, 100)).toBe(false)
  })

  it('foreground null (desktop, janela comum, helper fora) não mostra', () => {
    expect(shouldShowOverlay('win32', on, null, 100)).toBe(false)
  })

  it('desligado nas configurações não mostra', () => {
    expect(shouldShowOverlay('win32', { enabled: false, inCall: true }, game, 100)).toBe(false)
  })
})

describe('overlayBounds', () => {
  it('cobre a área de trabalho inteira do monitor do jogo (a lista é posicionada pelo CSS)', () => {
    const workArea = { x: -1920, y: 0, width: 1920, height: 1040 }
    expect(overlayBounds(workArea)).toEqual(workArea)
    expect(overlayBounds(workArea)).not.toBe(workArea)
  })
})

describe('overlayShortcuts', () => {
  it('Shift+Tab só com o overlay à vista', () => {
    expect(overlayShortcuts({ visible: true, editing: false, quitting: false })).toEqual({
      toggleEdit: true,
      exitEdit: false
    })
    expect(overlayShortcuts({ visible: false, editing: false, quitting: false })).toEqual({
      toggleEdit: false,
      exitEdit: false
    })
  })

  it('Esc só no modo de edição', () => {
    expect(overlayShortcuts({ visible: true, editing: true, quitting: false })).toEqual({
      toggleEdit: true,
      exitEdit: true
    })
  })

  it('overlay escondido nunca segura atalho, nem com edição pendurada', () => {
    expect(overlayShortcuts({ visible: false, editing: true, quitting: false })).toEqual({
      toggleEdit: false,
      exitEdit: false
    })
  })

  it('saindo do app, nada', () => {
    expect(overlayShortcuts({ visible: true, editing: true, quitting: true })).toEqual({
      toggleEdit: false,
      exitEdit: false
    })
  })
})
