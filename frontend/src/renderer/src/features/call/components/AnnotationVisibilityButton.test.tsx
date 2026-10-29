import { beforeEach, describe, expect, it, vi } from 'vitest'

// O CallAvatar lê quem fala do callStore (que puxa o áudio da call): ninguém fala aqui.
vi.mock('../store/callStore', () => ({
  useCallStore: (select: (s: { speakingIds: string[] }) => unknown) => select({ speakingIds: [] })
}))
vi.mock('../../chat/store/chatStore', () => ({
  useChatStore: { getState: vi.fn(() => ({ sendEvent: vi.fn() })) }
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'me' } })) }
}))

import { renderToStaticMarkup } from 'react-dom/server'
import { useAnnotationStore } from '../store/annotationStore'
import {
  AnnotationVisibilityButton,
  FullscreenAnnotationButtons
} from './AnnotationVisibilityButton'
import StreamAudioControls from './StreamAudioControls'
import FullscreenOverlay from './FullscreenOverlay'

describe('botão de ocultar desenhos', () => {
  beforeEach(() => useAnnotationStore.getState().cleanup())

  it('mostrando os desenhos: não pressionado, oferece ocultar só para mim', () => {
    const html = renderToStaticMarkup(<AnnotationVisibilityButton sharerId="s1" />)
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-label="Ocultar desenhos"')
    expect(html).toContain('Ocultar desenhos (só para você)')
  })

  it('a variante da tela cheia usa o botão maior', () => {
    const html = renderToStaticMarkup(
      <AnnotationVisibilityButton sharerId="s2" variant="overlay" />
    )
    expect(html).toContain('h-8 w-8')
  })

  it('a barra da tela cheia tem o lápis e o ocultar', () => {
    const html = renderToStaticMarkup(<FullscreenAnnotationButtons sharerId="s1" />)
    expect(html).toContain('Anotações na transmissão')
    expect(html).toContain('Ocultar desenhos')
  })

  it('aparece nos controles da live (com id) e na tela cheia, mas não na câmera', () => {
    expect(renderToStaticMarkup(<StreamAudioControls userId="s1" />)).toContain('Ocultar desenhos')
    expect(renderToStaticMarkup(<StreamAudioControls />)).not.toContain('Ocultar desenhos')
    expect(
      renderToStaticMarkup(<FullscreenOverlay name="Ana" userId="s1" onExit={() => {}} />)
    ).toContain('Ocultar desenhos')
    expect(renderToStaticMarkup(<FullscreenOverlay name="Ana" onExit={() => {}} />)).not.toContain(
      'Ocultar desenhos'
    )
  })
})
