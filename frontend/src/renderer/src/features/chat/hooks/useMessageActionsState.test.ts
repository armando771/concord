import { describe, expect, it, vi } from 'vitest'
import { touchMenuHandler } from './useMessageActionsState'

function contextMenu(pointerType?: string): React.MouseEvent {
  return {
    nativeEvent: pointerType ? { pointerType } : {},
    preventDefault: vi.fn()
  } as unknown as React.MouseEvent
}

describe('touchMenuHandler', () => {
  it('o contextmenu de um dedo (Android) abre o "Mais" e não o menu do autor', () => {
    const open = vi.fn()
    const e = contextMenu('touch')
    expect(touchMenuHandler({ firedRecently: () => false }, open)(e)).toBe(true)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(open).toHaveBeenCalledOnce()
  })

  it('o botão direito do mouse fica com o menu do autor', () => {
    const open = vi.fn()
    const e = contextMenu('mouse')
    expect(touchMenuHandler({ firedRecently: () => false }, open)(e)).toBe(false)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('logo depois de segurar o dedo, contextmenu sem pointerType também é do toque', () => {
    const open = vi.fn()
    expect(touchMenuHandler({ firedRecently: () => true }, open)(contextMenu())).toBe(true)
    expect(open).toHaveBeenCalledOnce()
  })
})
