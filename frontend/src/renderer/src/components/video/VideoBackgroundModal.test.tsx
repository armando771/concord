import { beforeEach, describe, expect, it, vi } from 'vitest'

// No render de servidor o zustand devolve sempre o estado inicial; os mocks
// deixam cada teste escolher o estado.
const state = vi.hoisted(() => ({
  modal: { mode: null as 'background' | 'preview' | null, close: vi.fn(), openBackground: vi.fn() },
  video: {
    background: { mode: 'none', image: null } as unknown,
    customs: [] as unknown[],
    cameraId: '',
    alwaysPreview: false,
    setAlwaysPreview: vi.fn(),
    setBackground: vi.fn(),
    addCustom: vi.fn(),
    removeCustom: vi.fn()
  },
  call: { toggleCamera: vi.fn() }
}))
vi.mock('../../store/videoModalStore', () => ({
  useVideoModalStore: (sel: (s: typeof state.modal) => unknown) => sel(state.modal)
}))
vi.mock('../../store/videoSettingsStore', () => ({
  useVideoSettingsStore: (sel: (s: typeof state.video) => unknown) => sel(state.video)
}))
vi.mock('../../store/callStore', () => ({
  useCallStore: (sel: (s: typeof state.call) => unknown) => sel(state.call)
}))
// A prévia abre a câmera (e o rtc puxa o RNNoise, que não existe no node).
vi.mock('../../lib/rtc', () => ({ getCameraStream: vi.fn() }))

import { renderToStaticMarkup } from 'react-dom/server'
import VideoBackgroundModal from './VideoBackgroundModal'

const render = (): string => renderToStaticMarkup(<VideoBackgroundModal />)

describe('VideoBackgroundModal', () => {
  beforeEach(() => {
    state.modal.mode = null
    state.video.alwaysPreview = false
    state.video.background = { mode: 'none', image: null }
  })

  it('fechado não renderiza nada', () => {
    expect(render()).toBe('')
  })

  it('"Mudar fundo de vídeo": título, fundo, checkbox e botão do print do Discord', () => {
    state.modal.mode = 'background'
    const html = render()
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('Mudar fundo de vídeo')
    expect(html).toContain('Fundo do vídeo')
    expect(html).toContain('Nenhum')
    expect(html).toContain('Borrar')
    expect(html).toContain('Personalizado')
    expect(html).toContain('Sempre ver prévia do vídeo')
    expect(html).toContain('Alterar plano de fundo')
    expect(html).toContain('aria-label="Fechar"')
    expect(html).not.toContain('Ligar câmera')
  })

  it('o checkbox reflete "sempre ver prévia"', () => {
    state.modal.mode = 'background'
    expect(render()).not.toMatch(/type="checkbox"[^>]*checked/)
    state.video.alwaysPreview = true
    expect(render()).toMatch(/type="checkbox"[^>]*checked/)
  })

  it('prévia antes de ligar: tem "Ligar câmera" e "Mudar fundo de vídeo", sem as imagens', () => {
    state.modal.mode = 'preview'
    const html = render()
    expect(html).toContain('Prévia do vídeo')
    expect(html).toContain('Ligar câmera')
    expect(html).toContain('Mudar fundo de vídeo')
    expect(html).toContain('Sempre ver prévia do vídeo')
    expect(html).not.toContain('Alterar plano de fundo')
    expect(html).not.toContain('Borrar')
  })

  it('a prévia começa abrindo a câmera', () => {
    state.modal.mode = 'background'
    expect(render()).toContain('Abrindo a câmera')
  })
})
