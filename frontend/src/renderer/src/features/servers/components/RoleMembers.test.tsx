import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  members: [] as { user_id: string; display_name: string; role_ids?: string[] }[],
  meId: 'dono'
}))
vi.mock('../store/serverStore', () => ({
  useServerStore: (select: (s: unknown) => unknown) =>
    select({
      currentMembers: state.members,
      addMemberRole: vi.fn(),
      removeMemberRole: vi.fn()
    })
}))
vi.mock('../hooks/useServerAccess', () => ({
  useServerAccess: () => ({
    canEditRolesOf: (id: string) => id !== 'dono' || state.meId === 'dono'
  })
}))
vi.mock('../../../shared/ui/Avatar', () => ({ default: () => <i /> }))

import { renderToStaticMarkup } from 'react-dom/server'
import type { Role } from '../lib/permissions'
import RoleMembers from './RoleMembers'

const role = { id: 'r1', name: 'Mods', is_system: false } as Role

const render = (over: { manageable?: boolean; role?: Role } = {}): string =>
  renderToStaticMarkup(
    <RoleMembers serverId="s1" role={over.role ?? role} manageable={over.manageable ?? true} />
  )

describe('RoleMembers', () => {
  it('lista quem tem o cargo, com a contagem', () => {
    state.members = [
      { user_id: 'a', display_name: 'Ana', role_ids: ['r1'] },
      { user_id: 'b', display_name: 'Bia', role_ids: ['r2'] },
      { user_id: 'c', display_name: 'Caio', role_ids: ['r1', 'r2'] }
    ]
    const html = render()
    expect(html).toContain('Com este cargo — 2')
    expect(html).toContain('Ana')
    expect(html).toContain('Caio')
    expect(html).not.toContain('Bia')
  })

  it('sem ninguém com o cargo, diz isso', () => {
    state.members = [{ user_id: 'b', display_name: 'Bia' }]
    const html = render()
    expect(html).toContain('Com este cargo — 0')
    expect(html).toContain('Ninguém tem este cargo ainda.')
  })

  it('quem gerencia o cargo vê "Adicionar membros" e "Remover"', () => {
    state.members = [{ user_id: 'a', display_name: 'Ana', role_ids: ['r1'] }]
    const html = render()
    expect(html).toContain('Adicionar membros')
    expect(html).toContain('Remover')
  })

  it('sem permissão para gerenciar, só lê a lista', () => {
    state.members = [{ user_id: 'a', display_name: 'Ana', role_ids: ['r1'] }]
    const html = render({ manageable: false })
    expect(html).not.toContain('Adicionar membros')
    expect(html).not.toContain('Remover')
    expect(html).toContain('Ana')
  })

  it('cargo de sistema não se altera nem aqui', () => {
    state.members = [{ user_id: 'a', display_name: 'Ana', role_ids: ['r1'] }]
    const html = render({ role: { ...role, is_system: true } as Role })
    expect(html).not.toContain('Adicionar membros')
    expect(html).not.toContain('Remover')
  })

  it('os cargos do dono só o dono mexe', () => {
    state.members = [{ user_id: 'dono', display_name: 'Dona', role_ids: ['r1'] }]
    state.meId = 'mod'
    expect(render()).not.toContain('Remover')
    state.meId = 'dono'
    expect(render()).toContain('Remover')
  })
})
