import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NameStyle } from '../lib/nameStyle'

// O componente importa CSS (sem efeito no vitest). O store é mockado: na
// renderização de servidor o zustand devolveria sempre o estado inicial.
vi.mock('../assets/nameStyle.css', () => ({}))
const profiles: Record<string, { name_style?: NameStyle }> = {}
vi.mock('../store/profileStore', () => ({
  useProfileStore: (select: (s: { profiles: typeof profiles }) => unknown) => select({ profiles })
}))
import StyledName from './StyledName'

beforeEach(() => {
  for (const key of Object.keys(profiles)) delete profiles[key]
})

describe('StyledName', () => {
  it('sem estilo mostra só o nome', () => {
    expect(renderToStaticMarkup(<StyledName name="Mugis" />)).toBe('<span>Mugis</span>')
  })
  it('usa o estilo recebido', () => {
    const html = renderToStaticMarkup(
      <StyledName name="Mugis" style={{ font: 'bit8', effect: 'neon', colors: ['#00ffaa'] }} />
    )
    expect(html).toContain('Press Start 2P')
    expect(html).toContain('#00ffaa')
  })
  it('o perfil ao vivo ganha do estilo recebido', () => {
    profiles.u1 = { name_style: { font: 'tempo', effect: 'solid', colors: [] } }
    const html = renderToStaticMarkup(
      <StyledName name="Mugis" userId="u1" style={{ font: 'bit8', effect: 'solid', colors: [] }} />
    )
    expect(html).toContain('Bitter')
    expect(html).not.toContain('Press Start')
  })
  it('sem perfil conhecido cai no estilo recebido', () => {
    const html = renderToStaticMarkup(
      <StyledName name="Mugis" userId="u2" style={{ font: 'bit8', effect: 'solid', colors: [] }} />
    )
    expect(html).toContain('Press Start 2P')
  })
  it('anima com classe e junta a classe de fora', () => {
    const html = renderToStaticMarkup(
      <StyledName
        name="Mugis"
        className="font-bold"
        style={{ font: 'default', effect: 'rainbow', colors: [] }}
      />
    )
    expect(html).toContain('class="font-bold name-rainbow"')
  })
})
