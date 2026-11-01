import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ImprovementsHubView } from './ImprovementsHub'

const render = (over: Partial<Parameters<typeof ImprovementsHubView>[0]> = {}): string =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ImprovementsHubView proposalsStat={null} rankStat={null} {...over} />
    </MemoryRouter>
  )

describe('ImprovementsHubView', () => {
  it('mostra os 3 cards, cada um levando à sua tela', () => {
    const html = render()
    expect(html).toContain('Propostas de melhorias')
    expect(html).toContain('Novidades')
    expect(html).toContain('Rank global')
    expect(html).toContain('href="/proposals"')
    expect(html).toContain('href="/changelog"')
    expect(html).toContain('href="/ranking"')
    expect(html.match(/<a /g)).toHaveLength(3)
  })

  it('mostra os dados ao vivo quando existem', () => {
    const html = render({ proposalsStat: '2 em votação', rankStat: 'Sua posição: #7' })
    expect(html).toContain('2 em votação')
    expect(html).toContain('Sua posição: #7')
  })

  it('cabe em 360 px: uma coluna e só vira 3 colunas no md', () => {
    const html = render()
    expect(html).toContain('grid-cols-1')
    expect(html).toContain('md:grid-cols-3')
  })
})
