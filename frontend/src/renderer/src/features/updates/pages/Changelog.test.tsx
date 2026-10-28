import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ChangelogView } from './Changelog'

const releases = [
  {
    version: '0.6.2',
    released_at: '2026-10-24T15:00:00Z',
    summary: '',
    entries: [
      { kind: 'feature' as const, text: 'Mensagens fixadas' },
      { kind: 'fix' as const, text: 'Som da chamada' }
    ]
  },
  { version: '0.6.1', released_at: '2026-10-20T15:00:00Z', summary: '', entries: [] }
]

const render = (over: Partial<Parameters<typeof ChangelogView>[0]> = {}): string =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ChangelogView releases={releases} current={null} loading={false} error={null} {...over} />
    </MemoryRouter>
  )

describe('ChangelogView', () => {
  it('mostra versão, novidades e correções', () => {
    const html = render()
    expect(html).toContain('v0.6.2')
    expect(html).toContain('Novidades')
    expect(html).toContain('Mensagens fixadas')
    expect(html).toContain('Correções')
    expect(html).toContain('Som da chamada')
  })

  it('tem o botão de voltar para o hub de melhorias', () => {
    expect(render()).toContain('href="/melhorias"')
  })

  it('marca a versão em uso', () => {
    expect(render({ current: '0.6.1' })).toContain('Você está aqui')
    expect(render({ current: null })).not.toContain('Você está aqui')
  })

  it('release sem entradas avisa que não há notas', () => {
    expect(render()).toContain('Sem notas para esta versão')
  })

  it('carregando, com erro e vazio', () => {
    expect(render({ loading: true, releases: [] })).toContain('Carregando')
    expect(render({ error: 'falhou', releases: [] })).toContain('falhou')
    expect(render({ releases: [] })).toContain('Nenhuma versão publicada ainda')
  })
})
