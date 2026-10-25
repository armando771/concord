import { describe, expect, it } from 'vitest'
import {
  overlayFrame,
  overlayWindowRect,
  OVERLAY_WINDOW_MARGIN,
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

describe('overlayWindowRect', () => {
  const workArea = { x: -1920, y: 0, width: 1920, height: 1040 }
  const box = { width: 200, height: 120 }
  const m = OVERLAY_WINDOW_MARGIN
  const centered = { position: null, scale: 1 }

  it('fora da edição: só a caixa da lista, com margem, na posição padrão', () => {
    // Padrão: borda esquerda (margem de 8 do CSS), no meio da altura.
    expect(overlayWindowRect(workArea, centered, box, false)).toEqual({
      x: -1920 + 8 - m,
      y: 460 - m,
      width: 200 + 2 * m,
      height: 120 + 2 * m
    })
  })

  it('posição salva (fração da área) dá o mesmo lugar que o CSS', () => {
    expect(
      overlayWindowRect(workArea, { position: { x: 0.5, y: 0.25 }, scale: 1.2 }, box, false)
    ).toEqual({ x: -1920 + 960 - m, y: 260 - m, width: 216, height: 136 })
  })

  it('caixa na borda: a margem é cortada, a janela não sai da área de trabalho', () => {
    expect(overlayWindowRect(workArea, { position: { x: 1, y: 1 }, scale: 1 }, box, false)).toEqual(
      { x: -1920 + 1720 - m, y: 920 - m, width: 200 + m, height: 120 + m }
    )
    expect(overlayWindowRect(workArea, { position: { x: 0, y: 0 }, scale: 1 }, box, false)).toEqual(
      { x: -1920, y: 0, width: 200 + m, height: 120 + m }
    )
  })

  it('editando: a área de trabalho inteira (para arrastar a qualquer lugar)', () => {
    expect(overlayWindowRect(workArea, centered, box, true)).toEqual(workArea)
    expect(overlayWindowRect(workArea, centered, box, true)).not.toBe(workArea)
  })

  it('caixa ainda não medida: área inteira, para a página poder medir', () => {
    expect(overlayWindowRect(workArea, centered, null, false)).toEqual(workArea)
    expect(overlayWindowRect(workArea, centered, { width: 0, height: 0 }, false)).toEqual(workArea)
  })

  it('caixa maior que a área: fica na área', () => {
    expect(overlayWindowRect({ x: 0, y: 0, width: 100, height: 80 }, centered, box, false)).toEqual(
      { x: 0, y: 0, width: 100, height: 80 }
    )
  })
})

describe('overlayFrame', () => {
  it('diz à página o tamanho da área e onde a janela está dentro dela', () => {
    const workArea = { x: -1920, y: 0, width: 1920, height: 1040 }
    expect(overlayFrame(workArea, { x: -1920, y: 452, width: 216, height: 136 })).toEqual({
      area: { width: 1920, height: 1040 },
      origin: { x: 0, y: 452 }
    })
    expect(overlayFrame(workArea, workArea)).toEqual({
      area: { width: 1920, height: 1040 },
      origin: { x: 0, y: 0 }
    })
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
