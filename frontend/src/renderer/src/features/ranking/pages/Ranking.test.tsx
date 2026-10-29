import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { Ranking, RankingEntry } from '../api/ranking'
import { RankingView } from './Ranking'

const entry = (position: number): RankingEntry => ({
  position,
  user_id: `u${position}`,
  username: `user${position}`,
  display_name: `Pessoa ${position}`,
  avatar_url: null,
  name_style: { font: 'default', effect: 'solid', colors: [] },
  level: 50 - position,
  xp: 100000 - position * 1000
})
const list = (n: number): Ranking['entries'] => Array.from({ length: n }, (_, i) => entry(i + 1))

const render = (over: Partial<Parameters<typeof RankingView>[0]> = {}): string =>
  renderToStaticMarkup(
    <MemoryRouter>
      <RankingView ranking={null} loading={false} error={null} onRetry={() => {}} {...over} />
    </MemoryRouter>
  )

describe('RankingView', () => {
  it('mostra o pódio na ordem 2º, 1º, 3º e a lista do 4º em diante', () => {
    const html = render({ ranking: { entries: list(6), me: null } })
    const order = ['Pessoa 2', 'Pessoa 1', 'Pessoa 3', 'Pessoa 4', 'Pessoa 6']
    const positions = order.map((n) => html.indexOf(n))
    expect(positions.every((p) => p > 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(html).toContain('aria-label="Pódio"')
    expect(html).toContain('#4')
    expect(html).toContain('Nv 46')
    expect(html).toContain('96.000 XP')
  })

  it('só pódio quando há menos de 4 pessoas (sem lista abaixo)', () => {
    const html = render({ ranking: { entries: list(3), me: null } })
    expect(html).not.toContain('aria-label="Classificação"')
  })

  it('mostra "Sua posição" mesmo fora do top 100', () => {
    const html = render({
      ranking: { entries: list(100), me: { position: 250, level: 7, xp: 1234 } }
    })
    expect(html).toContain('Sua posição: #250')
    expect(html).toContain('Nv 7')
  })

  it('sem XP, convida a entrar numa call', () => {
    const html = render({ ranking: { entries: list(4), me: null } })
    expect(html).toContain('Fique em call para entrar no ranking')
  })

  it('estado vazio', () => {
    const html = render({ ranking: { entries: [], me: null } })
    expect(html).toContain('Ninguém no ranking ainda')
    expect(html).not.toContain('Sua posição')
  })

  it('carregando mostra o skeleton acessível', () => {
    expect(render({ loading: true })).toContain('Carregando o ranking…')
  })

  it('erro mostra a mensagem e o botão de tentar de novo', () => {
    const html = render({ error: 'Não foi possível carregar o ranking.' })
    expect(html).toContain('Não foi possível carregar o ranking.')
    expect(html).toContain('Tentar de novo')
  })

  it('cabe em 360 px: coluna única, sem largura fixa', () => {
    const html = render({ ranking: { entries: list(5), me: null } })
    expect(html).toContain('min-w-0')
    expect(html).not.toMatch(/w-\[\d+px\]/)
  })
})
