import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import HubBackFrame from './HubBackFrame'

describe('HubBackFrame', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <HubBackFrame>
        <header>Rank global</header>
      </HubBackFrame>
    </MemoryRouter>
  )

  it('mostra a tela e um voltar que leva ao hub', () => {
    expect(html).toContain('Rank global')
    expect(html).toContain('href="/melhorias"')
    expect(html).toContain('aria-label="Voltar para Melhorias"')
  })

  it('o botão tem alvo de toque de 40 px e o cabeçalho abre espaço para ele', () => {
    expect(html).toContain('size-10')
    expect(html).toContain('[&amp;_header]:pl-14')
  })
})
