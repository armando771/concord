import { beforeEach, describe, expect, it, vi } from 'vitest'

// No render de servidor o zustand devolve sempre o estado inicial; os mocks
// deixam cada teste escolher o estado.
const state = vi.hoisted(() => ({
  video: {
    cameraId: '',
    alwaysPreview: false,
    background: { mode: 'none', image: null } as unknown,
    customs: [] as unknown[],
    setAlwaysPreview: vi.fn(),
    setBackground: vi.fn(),
    addCustom: vi.fn(),
    removeCustom: vi.fn()
  },
  call: { setCameraDevice: vi.fn() }
}))
vi.mock('../../../call/store/videoSettingsStore', () => ({
  useVideoSettingsStore: (sel: (s: typeof state.video) => unknown) => sel(state.video)
}))
vi.mock('../../../call/store/callStore', () => ({
  useCallStore: (sel: (s: typeof state.call) => unknown) => sel(state.call)
}))
// A prévia abre a câmera (e o rtc puxa o RNNoise, que não existe no node).
vi.mock('../../../call/lib/rtc', () => ({ getCameraStream: vi.fn() }))

import { renderToStaticMarkup } from 'react-dom/server'
import { VideoSection } from './VideoSection'

const render = (): string => renderToStaticMarkup(<VideoSection />)

describe('VideoSection (Configurações → Vídeo)', () => {
  beforeEach(() => {
    state.video.alwaysPreview = false
    state.video.cameraId = ''
    state.video.background = { mode: 'none', image: null }
    state.video.customs = []
  })

  it('tem a câmera, a prévia, "sempre ver prévia" e o fundo do vídeo', () => {
    const html = render()
    expect(html).toContain('Câmera')
    expect(html).toContain('Padrão do sistema')
    expect(html).toContain('Testar vídeo')
    expect(html).toContain('Clique em “Testar vídeo”')
    expect(html).toContain('Sempre ver prévia do vídeo')
    expect(html).toContain('Fundo do vídeo')
    expect(html).toContain('Nenhum')
    expect(html).toContain('Borrar')
    expect(html).toContain('Personalizado')
  })

  it('lista as imagens prontas do app', () => {
    const html = render()
    expect(html).toContain('aria-label="Aurora"')
    expect(html).toContain('aria-label="Cidade neon"')
  })

  it('a prévia começa desligada (a câmera só abre ao pedir)', () => {
    const html = render()
    expect(html).not.toContain('<video')
    expect(html).not.toContain('Parar teste')
  })

  it('o interruptor reflete "sempre ver prévia"', () => {
    expect(render()).toMatch(/aria-checked="false"[^>]*aria-label="Sempre ver prévia do vídeo"/)
    state.video.alwaysPreview = true
    expect(render()).toMatch(/aria-checked="true"[^>]*aria-label="Sempre ver prévia do vídeo"/)
  })

  it('não tem nada de chroma key', () => {
    const html = render().toLowerCase()
    for (const word of ['chroma', 'pano', 'sensibilidade', 'conta-gotas']) {
      expect(html).not.toContain(word)
    }
  })
})
