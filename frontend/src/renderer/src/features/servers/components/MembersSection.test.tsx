import { describe, expect, it, vi } from 'vitest'
import type { Role } from '../lib/permissions'

const state = vi.hoisted(() => ({
  meId: 'dono',
  perms: 0,
  isOwner: true,
  highest: 0,
  canAct: ((_id: string) => false) as (id: string) => boolean,
  roles: [] as unknown[],
  members: [] as Array<{
    user_id: string
    display_name: string
    username?: string
    role_ids?: string[]
  }>
}))

vi.mock('../store/serverStore', () => ({
  useServerStore: (select: (s: unknown) => unknown) =>
    select({
      currentServer: { id: 's1', owner_id: 'dono' },
      currentMembers: state.members,
      roles: state.roles,
      addMemberRole: vi.fn(),
      removeMemberRole: vi.fn()
    })
}))
vi.mock('../hooks/useServerAccess', () => ({
  useServerAccess: () => ({
    isOwner: state.isOwner,
    highest: state.highest,
    can: (want: number) => (state.perms & want) === want,
    canActOnMember: (id: string) => state.canAct(id),
    canChangeNickname: () => false,
    canEditRolesOf: (id: string) => id !== 'dono' || state.meId === 'dono'
  })
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: state.meId } })
}))
vi.mock('../../call/store/moderationStore', () => ({
  useModerationStore: (select: (s: unknown) => unknown) =>
    select({ askKick: vi.fn(), askBan: vi.fn(), askNickname: vi.fn() })
}))
vi.mock('../../../shared/ui/Avatar', () => ({ default: () => <i /> }))

import { renderToStaticMarkup } from 'react-dom/server'
import { ALL_PERMISSIONS, Perm } from '../lib/permissions'
import MembersSection from './MembersSection'

const role = (id: string, position: number): Role =>
  ({
    id,
    server_id: 's1',
    name: id,
    color: null,
    position,
    permissions: 0,
    hoist: false,
    is_default: false
  }) as Role

const asOwner = (): void => {
  state.meId = 'dono'
  state.isOwner = true
  state.perms = ALL_PERMISSIONS
  state.highest = 0
  state.canAct = (id) => id !== 'dono'
}

const asModerator = (): void => {
  state.meId = 'mod'
  state.isOwner = false
  state.perms = Perm.MANAGE_ROLES | Perm.KICK_MEMBERS
  state.highest = 5
  state.canAct = (id) => id === 'ana'
}

describe('MembersSection', () => {
  state.roles = [role('alto', 9), role('vip', 2)]
  state.members = [
    { user_id: 'dono', display_name: 'Dona', role_ids: [] },
    { user_id: 'mod', display_name: 'Moderadora', role_ids: [] },
    { user_id: 'ana', display_name: 'Ana', username: 'ana', role_ids: ['vip'] }
  ]

  it('lista os membros com o @ e os cargos de cada um', () => {
    asOwner()
    const html = renderToStaticMarkup(<MembersSection />)
    expect(html).toContain('Membros — 3')
    expect(html).toContain('@ana')
    expect(html).toContain('Tirar o cargo vip de Ana')
  })

  it('expulsar só aparece em quem está abaixo; banir pede a permissão', () => {
    asModerator()
    const html = renderToStaticMarkup(<MembersSection />)
    expect(html.match(/Expulsar/g)).toHaveLength(1)
    expect(html).not.toContain('Banir')
  })

  it('quem não pode gerenciar cargos não vê o + nem o ×', () => {
    asModerator()
    state.perms = Perm.KICK_MEMBERS
    const html = renderToStaticMarkup(<MembersSection />)
    expect(html).not.toContain('Dar um cargo')
    expect(html).not.toContain('Tirar o cargo')
  })

  it('o moderador dá cargo a outros membros', () => {
    asModerator()
    const html = renderToStaticMarkup(<MembersSection />)
    expect(html).toContain('Dar um cargo a Ana')
  })

  // Regressão da issue #331: o dono não conseguia dar cargos a si mesmo.
  it('o dono dá e tira cargos de si mesmo', () => {
    asOwner()
    state.members[0].role_ids = ['vip']
    const html = renderToStaticMarkup(<MembersSection />)
    expect(html).toContain('Dar um cargo a Dona')
    expect(html).toContain('Tirar o cargo vip de Dona')
    state.members[0].role_ids = []
  })

  it('só o dono mexe nos cargos do dono', () => {
    asModerator()
    state.members[0].role_ids = ['vip']
    const html = renderToStaticMarkup(<MembersSection />)
    expect(html).not.toContain('Dar um cargo a Dona')
    expect(html).not.toContain('Tirar o cargo vip de Dona')
    expect(html).toContain('Tirar o cargo vip de Ana')
    state.members[0].role_ids = []
  })

  // Issue #332: o dono não aparece como um cargo "Dono", e sim com a coroa.
  it('o dono tem a coroa ao lado do nome, não uma etiqueta de cargo', () => {
    asOwner()
    const html = renderToStaticMarkup(<MembersSection />)
    expect(html.match(/aria-label="Dono do servidor"/g)).toHaveLength(1)
    expect(html).not.toContain('>Dono<')
  })
})
