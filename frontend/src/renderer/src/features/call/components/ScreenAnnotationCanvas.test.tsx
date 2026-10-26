import { describe, expect, it, vi } from 'vitest'

vi.mock('../../chat/store/chatStore', () => ({
  useChatStore: { getState: vi.fn(() => ({ sendEvent: vi.fn() })) }
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'me' } })) }
}))

import { renderToStaticMarkup } from 'react-dom/server'
import ScreenAnnotationCanvas from './ScreenAnnotationCanvas'

describe('ScreenAnnotationCanvas', () => {
  it('fora do modo desenho a camada deixa o clique passar para o vídeo', () => {
    const html = renderToStaticMarkup(
      <ScreenAnnotationCanvas sharerId="s1" callId="c1" isDrawingMode={false} />
    )
    expect(html).toContain('<canvas')
    expect(html).toContain('pointer-events-none')
  })

  it('no modo desenho a camada captura o ponteiro', () => {
    const html = renderToStaticMarkup(
      <ScreenAnnotationCanvas sharerId="s1" callId="c1" isDrawingMode />
    )
    expect(html).toContain('pointer-events-auto')
    expect(html).toContain('cursor-crosshair')
  })
})
