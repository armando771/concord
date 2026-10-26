import { beforeEach, describe, expect, it, vi } from 'vitest'

// A prévia importa o rtc, que puxa o RNNoise (AudioWorklet não existe no node).
vi.mock('../lib/rtc', () => ({ getCameraStream: vi.fn() }))

// No render de servidor o zustand devolve sempre o estado inicial; o mock
// deixa cada teste escolher o estado.
const store = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))
vi.mock('../store/chromaKeyStore', () => ({
  useChromaKeyStore: () => store.state,
  chromaKeySettings: (s: unknown) => s
}))

import { renderToStaticMarkup } from 'react-dom/server'
import ChromaKeySettings from './ChromaKeySettings'
import { DEFAULT_CHROMA_KEY } from '../lib/chromaKey'

const useChromaKeyStore = {
  setState: (patch: Record<string, unknown>): void => {
    store.state = { ...store.state, ...patch }
  }
}

const render = (): string => renderToStaticMarkup(<ChromaKeySettings />)

describe('ChromaKeySettings', () => {
  beforeEach(() => {
    store.state = {
      ...DEFAULT_CHROMA_KEY,
      background: { ...DEFAULT_CHROMA_KEY.background },
      setEnabled: vi.fn(),
      setKeyColor: vi.fn(),
      setSimilarity: vi.fn(),
      setSmoothness: vi.fn(),
      setBackground: vi.fn()
    }
  })

  it('desligado: mostra só o interruptor', () => {
    const html = render()
    expect(html).toContain('Chroma key')
    expect(html).toContain('aria-checked="false"')
    expect(html).not.toContain('Sensibilidade')
    expect(html).not.toContain('Testar com a câmera')
  })

  it('ligado: mostra cor, sensibilidade, suavidade, fundo e prévia', () => {
    useChromaKeyStore.setState({ enabled: true })
    const html = render()
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('Verde')
    expect(html).toContain('Azul')
    expect(html).toContain('Sensibilidade')
    expect(html).toContain('Suavidade da borda')
    expect(html).toContain('Cor sólida')
    expect(html).toContain('Imagem personalizada')
    expect(html).toContain('Testar com a câmera')
  })

  it('mostra os valores salvos dos sliders', () => {
    useChromaKeyStore.setState({ enabled: true, similarity: 0.7, smoothness: 0.25 })
    const html = render()
    expect(html).toContain('70%')
    expect(html).toContain('25%')
  })

  it('o preset da cor atual vem marcado', () => {
    useChromaKeyStore.setState({ enabled: true, keyColor: '#0047bb' })
    const html = render()
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:<span[^>]*><\/span>)Azul/)
  })

  it('modo cor sólida mostra o seletor de cor do fundo; imagem não', () => {
    useChromaKeyStore.setState({ enabled: true })
    expect(render()).toContain('aria-label="Cor do fundo"')
    useChromaKeyStore.setState({
      background: { mode: 'image', color: '#000000', image: 'data:image/jpeg;base64,AAA' }
    })
    const html = render()
    expect(html).not.toContain('aria-label="Cor do fundo"')
    expect(html).toContain('Trocar imagem')
  })
})
