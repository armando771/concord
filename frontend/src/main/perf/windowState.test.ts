import { describe, expect, it } from 'vitest'
import { trackHidden, windowState } from './windowState'

interface FakeWindow {
  isDestroyed(): boolean
  isMinimized(): boolean
  isVisible(): boolean
}

const win = (destroyed: boolean, minimized: boolean, visible: boolean): FakeWindow => ({
  isDestroyed: () => destroyed,
  isMinimized: () => minimized,
  isVisible: () => visible
})

describe('windowState', () => {
  it('visível', () => expect(windowState(win(false, false, true), false)).toBe('visible'))
  it('minimizada', () => expect(windowState(win(false, true, false), false)).toBe('minimized'))
  it('oculta (bandeja)', () => expect(windowState(win(false, false, false), false)).toBe('tray'))

  it('oculta depois de minimizada continua sendo bandeja (isMinimized segue true)', () => {
    expect(windowState(win(false, true, false), true)).toBe('tray')
  })

  it('sem janela ou destruída conta como bandeja', () => {
    expect(windowState(null, false)).toBe('tray')
    expect(windowState(win(true, false, true), false)).toBe('tray')
  })
})

describe('trackHidden', () => {
  function emitter(): {
    on(event: 'show' | 'hide', listener: () => void): void
    emit(event: 'show' | 'hide'): void
  } {
    const listeners: Record<string, Array<() => void>> = {}
    return {
      on: (event, listener) => {
        listeners[event] = [...(listeners[event] ?? []), listener]
      },
      emit: (event) => (listeners[event] ?? []).forEach((l) => l())
    }
  }

  it('começa oculta, porque o app cria a janela com show:false', () => {
    expect(trackHidden(emitter())()).toBe(true)
  })

  it('show mostra e hide oculta de novo', () => {
    const win = emitter()
    const isHidden = trackHidden(win)
    win.emit('show')
    expect(isHidden()).toBe(false)
    win.emit('hide')
    expect(isHidden()).toBe(true)
  })
})
