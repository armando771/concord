import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('../../features/chat/store/chatStore', () => ({
  useChatStore: { getState: () => ({ retryWsNow: vi.fn() }) }
}))
import { BannerView } from './ConnectionBanner'

afterEach(() => {
  vi.unstubAllGlobals()
})

const desktop = { api: { server: { url: null, diagnostics: () => Promise.resolve(null) } } }

describe('BannerView', () => {
  it('queda no desktop: tentativa, "Tentar agora" e "Detalhes"', () => {
    vi.stubGlobal('window', desktop)
    const html = renderToStaticMarkup(<BannerView banner={{ kind: 'lost', attempt: 3 }} />)
    expect(html).toContain('Sem conexão — tentando reconectar… (tentativa 3)')
    expect(html).toContain('Tentar agora')
    expect(html).toContain('Detalhes')
  })

  it('offline: sem "Tentar agora", mas com "Detalhes"', () => {
    vi.stubGlobal('window', desktop)
    const html = renderToStaticMarkup(<BannerView banner={{ kind: 'offline' }} />)
    expect(html).not.toContain('Tentar agora')
    expect(html).toContain('Detalhes')
  })

  it('servidor atualizando e reconectado: só o aviso', () => {
    vi.stubGlobal('window', desktop)
    const restarting = renderToStaticMarkup(<BannerView banner={{ kind: 'restarting' }} />)
    expect(restarting).toContain('Servidor atualizando')
    expect(restarting).not.toContain('Detalhes')
    const back = renderToStaticMarkup(<BannerView banner={{ kind: 'reconnected' }} />)
    expect(back).toContain('Reconectado')
    expect(back).not.toContain('animate-pulse')
  })

  it('no navegador a queda não oferece "Detalhes"', () => {
    vi.stubGlobal('window', {})
    const html = renderToStaticMarkup(<BannerView banner={{ kind: 'lost', attempt: 1 }} />)
    expect(html).toContain('Tentar agora')
    expect(html).not.toContain('Detalhes')
  })
})
