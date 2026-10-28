import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Badge } from '../api/badges'
import BadgesAside from './BadgesAside'

vi.mock('../../../shared/ui/Avatar', () => ({ default: () => <i data-avatar /> }))

const badge = (category: string, tier: number): Badge =>
  ({ category, name: `Badge ${category}`, tier, tier_name: 'Prata', tiers: [] }) as unknown as Badge
const ganho = badge('voz', 2)

function render(over: Partial<React.ComponentProps<typeof BadgesAside>> = {}): string {
  return renderToStaticMarkup(
    <BadgesAside
      target={{ userId: 'u1', name: 'Ana' }}
      isMe={false}
      titleId="t"
      badges={[ganho]}
      earned={[ganho]}
      selected={ganho}
      onSelect={() => {}}
      canViewMine
      onViewMine={() => {}}
      {...over}
    />
  )
}

describe('BadgesAside', () => {
  it('no perfil de outra pessoa mostra o nome dela, o avatar e "Ver seus badges"', () => {
    const html = render()
    expect(html).toContain('Badges de Ana')
    expect(html).toContain('data-avatar')
    expect(html).toContain('Ver seus badges')
  })

  it('sem conta logada não oferece "Ver seus badges"', () => {
    expect(render({ canViewMine: false })).not.toContain('Ver seus badges')
  })

  it('no próprio perfil: "Seus badges", sem avatar nem "Ver seus badges", e nada do que falta ganhar', () => {
    const html = render({ isMe: true })
    expect(html).toContain('Seus badges')
    expect(html).not.toContain('data-avatar')
    expect(html).not.toContain('Ver seus badges')
    expect(html).not.toContain('Disponíveis para desbloquear')
    expect(html).not.toContain('desbloquear')
    expect(html).not.toMatch(/ de \d+ badges/)
  })

  it('o badge selecionado fica marcado na grade', () => {
    expect(render()).toContain('aria-pressed="true"')
  })

  it('enquanto carrega mostra o esqueleto, sem lista', () => {
    const html = render({ badges: undefined, earned: [] })
    expect(html).toContain('Carregando badges')
    expect(html).not.toContain('Nenhum badge ainda.')
  })

  it('sem badges ganhos diz isso, em cada perfil à sua maneira', () => {
    expect(render({ earned: [], badges: [] })).toContain('Nenhum badge ainda.')
    expect(render({ earned: [], badges: [], isMe: true })).toContain(
      'Nenhum badge ainda. Eles aparecem conforme você usa o Salinha.'
    )
  })
})
