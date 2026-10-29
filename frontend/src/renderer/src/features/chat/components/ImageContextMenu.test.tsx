import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('window', {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
})

vi.mock('../lib/imageClipboard', () => ({ copyImage: vi.fn() }))

// Mesmo truque do UserProfileContextMenu.test: lê o estado atual do zustand no SSR.
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) =>
  getSnapshot()
)

import { useImageMenuStore } from '../store/imageMenuStore'
import ImageContextMenu from './ImageContextMenu'

describe('ImageContextMenu', () => {
  beforeEach(() => {
    useImageMenuStore.setState({ target: null })
  })

  it('sem alvo, não renderiza nada', () => {
    expect(renderToStaticMarkup(<ImageContextMenu />)).toBe('')
  })

  it('com alvo, mostra só "Copiar imagem" acima dos outros menus', () => {
    useImageMenuStore
      .getState()
      .open({ attachmentId: 'att-1', contentType: 'image/png', x: 50, y: 60 })

    const html = renderToStaticMarkup(<ImageContextMenu />)

    expect(html).toContain('Copiar imagem')
    expect(html).toContain('z-[80]')
    expect(html).toContain('role="menu"')
  })
})
