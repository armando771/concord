import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ProfileRoleChips from './ProfileRoleChips'

const owner = { label: 'Dono do servidor', color: '#f59e0b' }
const vip = { id: 'vip', name: 'VIP', color: 0xff00ff }
const render = (props: Partial<Parameters<typeof ProfileRoleChips>[0]>): string =>
  renderToStaticMarkup(<ProfileRoleChips roles={[]} background={[]} ink="light" {...props} />)

// Issue #332: o dono não é um cargo; aparece com a coroa junto dos cargos dele.
describe('ProfileRoleChips', () => {
  it('o dono ganha a coroa ao lado dos cargos, sem uma pílula "Dono"', () => {
    const html = render({ roles: [vip], owner })
    expect(html).toContain('aria-label="Dono do servidor"')
    expect(html).toContain('VIP')
    expect(html).not.toContain('>Dono do servidor<')
    expect(html).not.toContain('Sem cargo')
  })

  it('o dono sem cargo nenhum: a coroa e "Sem cargo"', () => {
    const html = render({ owner })
    expect(html).toContain('aria-label="Dono do servidor"')
    expect(html).toContain('Sem cargo')
  })

  it('quem não é dono só tem os cargos', () => {
    const html = render({ roles: [vip] })
    expect(html).not.toContain('Dono do servidor')
    expect(html).toContain('VIP')
  })
})
