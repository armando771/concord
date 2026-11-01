import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Badge } from '../api/badges'
import BadgeGrid from './BadgeGrid'

const badge = (category: string, tier: number): Badge =>
  ({ category, name: `Nome ${category}`, tier, tier_name: 'Ouro', tiers: [] }) as unknown as Badge

describe('BadgeGrid', () => {
  it('uma peça por badge, com o selecionado marcado', () => {
    const html = renderToStaticMarkup(
      <BadgeGrid badges={[badge('voz', 1), badge('chat', 2)]} selected="chat" onSelect={() => {}} />
    )
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
  })

  it('o título mostra o tier e o nome', () => {
    const html = renderToStaticMarkup(
      <BadgeGrid badges={[badge('voz', 1)]} selected={undefined} onSelect={() => {}} />
    )
    expect(html).toContain('title="Ouro · Nome voz"')
  })
})
