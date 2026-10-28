import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Badge } from '../api/badges'
import BadgeTierLadder from './BadgeTierLadder'

const badge = {
  category: 'voz',
  name: 'Tempo em call',
  description: '',
  unit: 'seconds',
  value: 30 * 3600,
  tier: 2,
  tier_name: 'Tagarela',
  rarity: 'comum',
  tiers: [
    { tier: 1, name: 'Calado', threshold: 3600, rarity: 'comum', unlocked_at: '2026-10-20' },
    { tier: 2, name: 'Tagarela', threshold: 36000, rarity: 'comum', unlocked_at: '2026-10-24' }
  ]
} as unknown as Badge

describe('BadgeTierLadder', () => {
  it('mostra só o nome e o dia dos tiers conquistados', () => {
    const html = renderToStaticMarkup(<BadgeTierLadder badge={badge} />)
    expect(html).toContain('Calado')
    expect(html).toContain('Tagarela')
    expect(html).toContain('20/10/26')
    expect(html).toContain('24/10/26')
  })

  it('não mostra limites nem cadeado: nada para farmar', () => {
    const html = renderToStaticMarkup(<BadgeTierLadder badge={badge} />)
    expect(html).not.toMatch(/\d+ horas?/)
    expect(html).not.toMatch(/falta/i)
    expect(html).not.toContain('<svg')
    expect((html.match(/<li[ >]/g) ?? []).length).toBe(2)
  })
})
