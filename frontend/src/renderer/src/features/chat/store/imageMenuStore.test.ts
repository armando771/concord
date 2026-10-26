import { beforeEach, describe, expect, it, vi } from 'vitest'
import { imageMenuHandler, useImageMenuStore } from './imageMenuStore'

function fakeEvent(): React.MouseEvent {
  return {
    clientX: 120,
    clientY: 80,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as React.MouseEvent
}

describe('imageMenuHandler', () => {
  beforeEach(() => {
    useImageMenuStore.setState({ target: null })
  })

  it('PNG: abre o menu na posição do clique e não deixa o evento subir', () => {
    const e = fakeEvent()
    imageMenuHandler('att-1', 'image/png')(e)

    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(useImageMenuStore.getState().target).toEqual({
      attachmentId: 'att-1',
      contentType: 'image/png',
      x: 120,
      y: 80
    })
  })

  it('GIF: cancela o menu do navegador, mas não abre nada', () => {
    const e = fakeEvent()
    imageMenuHandler('att-2', 'image/gif')(e)

    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(useImageMenuStore.getState().target).toBeNull()
  })
})
