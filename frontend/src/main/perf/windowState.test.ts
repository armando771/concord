import { describe, expect, it } from 'vitest'
import { windowState } from './windowState'

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
  it('visível', () => expect(windowState(win(false, false, true))).toBe('visible'))
  it('minimizada', () => expect(windowState(win(false, true, false))).toBe('minimized'))
  it('oculta (bandeja)', () => expect(windowState(win(false, false, false))).toBe('tray'))
  it('sem janela ou destruída conta como bandeja', () => {
    expect(windowState(null)).toBe('tray')
    expect(windowState(win(true, false, true))).toBe('tray')
  })
})
