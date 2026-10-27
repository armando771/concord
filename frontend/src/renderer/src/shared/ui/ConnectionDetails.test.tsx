import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ConnectionDetails, { DetailsPanel } from './ConnectionDetails'

afterEach(() => {
  vi.unstubAllGlobals()
})

const desktop = { api: { server: { url: null, diagnostics: () => Promise.resolve(null) } } }

describe('ConnectionDetails', () => {
  it('no app desktop oferece "Detalhes" (fechado)', () => {
    vi.stubGlobal('window', desktop)
    const html = renderToStaticMarkup(<ConnectionDetails />)
    expect(html).toContain('Detalhes')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('connection-details')
  })

  it('no navegador não aparece (não há o teste de rede do app)', () => {
    vi.stubGlobal('window', {})
    expect(renderToStaticMarkup(<ConnectionDetails />)).toBe('')
  })

  it('o painel abre testando (o resultado chega do main) e oferece copiar', () => {
    vi.stubGlobal('window', desktop)
    const html = renderToStaticMarkup(<DetailsPanel />)
    expect(html).toContain('data-testid="connection-details"')
    expect(html).toContain('Testando a conexão…')
    expect(html).toContain('Testando…')
    expect(html).toContain('Copiar')
  })
})
