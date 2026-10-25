import { describe, expect, it } from 'vitest'
import {
  overlayBounds,
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
  it('faixa na borda esquerda com a altura do monitor', () => {
    expect(overlayBounds({ x: -1920, y: 0, width: 1920, height: 1080 })).toEqual({
      x: -1920,
      y: 0,
      width: 280,
      height: 1080
    })
  })
})
