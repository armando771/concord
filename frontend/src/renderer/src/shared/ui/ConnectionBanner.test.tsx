import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('../../features/chat/store/chatStore', () => ({
  useChatStore: { getState: () => ({ retryWsNow: vi.fn() }) }
}))
import { BannerView } from './ConnectionBanner'

describe('BannerView', () => {
  it('queda: tentativa e "Tentar agora"', () => {
    const html = renderToStaticMarkup(<BannerView banner={{ kind: 'lost', attempt: 3 }} />)
    expect(html).toContain('Sem conexão — tentando reconectar… (tentativa 3)')
    expect(html).toContain('Tentar agora')
  })

  it('offline: sem "Tentar agora"', () => {
    const html = renderToStaticMarkup(<BannerView banner={{ kind: 'offline' }} />)
    expect(html).toContain('Você está offline')
    expect(html).not.toContain('Tentar agora')
  })

  it('servidor atualizando e reconectado: só o aviso', () => {
    expect(renderToStaticMarkup(<BannerView banner={{ kind: 'restarting' }} />)).toContain(
      'Servidor atualizando'
    )
    const back = renderToStaticMarkup(<BannerView banner={{ kind: 'reconnected' }} />)
    expect(back).toContain('Reconectado')
    expect(back).not.toContain('animate-pulse')
  })
})
