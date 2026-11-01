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
  tier: 1,
  tier_name: 'Calado',
  rarity: 'comum',
  tiers: [
    { tier: 1, name: 'Calado', threshold: 3600, rarity: 'comum', unlocked_at: '2026-10-20' },
    { tier: 2, name: 'Tagarela', threshold: 36000, rarity: 'comum' }
  ]
} as unknown as Badge

describe('BadgeTierLadder', () => {
  it('mostra os tiers conquistados e, depois deles, os próximos com o limite', () => {
    const html = renderToStaticMarkup(<BadgeTierLadder badge={badge} />)
    expect(html).toContain('Calado')
    expect(html).toContain('1 hora')
    expect(html).toContain('Desbloqueado em 20/10/26')
    expect(html).toContain('Tagarela')
    expect(html).toContain('10 horas')
  })
})
