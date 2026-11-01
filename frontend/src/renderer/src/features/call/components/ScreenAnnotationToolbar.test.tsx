import { describe, it, expect, vi } from 'vitest'

vi.mock('../../chat/store/chatStore', () => ({
  useChatStore: {
    getState: vi.fn(() => ({ sendEvent: vi.fn() }))
  }
}))

import { renderToStaticMarkup } from 'react-dom/server'
import ScreenAnnotationToolbar from './ScreenAnnotationToolbar'

describe('ScreenAnnotationToolbar', () => {
  it('renderiza os botões de ferramentas, cores e ações', () => {
    const html = renderToStaticMarkup(
      <ScreenAnnotationToolbar
        sharerId="user-1"
        callId="call-1"
        onClose={() => {}}
      />
    )

    expect(html).toContain('Caneta')
    expect(html).toContain('Marca-texto')
    expect(html).toContain('Laser')
    expect(html).toContain('Borracha')
    expect(html).toContain('Limpar todas as anotações')
    expect(html).toContain('Desfazer')
  })
})
