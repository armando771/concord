import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '../lib/permissions'

vi.mock('../api/channels', () => ({}))
vi.mock('../api/servers', () => ({}))
vi.mock('../api/invites', () => ({}))
vi.mock('../api/roles', () => ({}))
vi.mock('./authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: 't' }) }
}))

const { useServerStore } = await import('./serverStore')
const { handleServerRoleEvent, removedMessage } = await import('./serverEvents')

const role = (id: string, position: number, extra: Partial<Role> = {}): Role => ({
  id,
  server_id: 's1',
  name: id,
  color: null,
  position,
  permissions: 0,
  hoist: false,
  is_default: false,
  ...extra
})

const deps = {
  onServerRemoved: vi.fn(),
  onPermissionsChanged: vi.fn()
}
const send = (type: string, payload: Record<string, unknown>): boolean =>
  handleServerRoleEvent({ type, payload }, deps)
const roleIds = (): string[] => useServerStore.getState().roles.map((r) => r.id)

beforeEach(() => {
  deps.onServerRemoved.mockReset()
  deps.onPermissionsChanged.mockReset()
  useServerStore.setState({
    currentServer: { id: 's1' } as never,
    currentMembers: [
      { server_id: 's1', user_id: 'ana', role: 'member', role_ids: ['a', 'b'] },
      { server_id: 's1', user_id: 'bia', role: 'member', role_ids: ['b'] }
    ],
    roles: [role('b', 2), role('a', 1), role('everyone', 0, { is_default: true })],
    nicknames: { s1: { bia: 'Bibi' } }
  })
})

describe('eventos de cargos', () => {
  it('role:create entra na posição certa', () => {
    expect(send('role:create', { server_id: 's1', role: role('novo', 3) })).toBe(true)
    expect(roleIds()).toEqual(['novo', 'b', 'a', 'everyone'])
  })

  it('role:update troca o cargo e reordena', () => {
    send('role:update', {
      server_id: 's1',
      role: { ...role('a', 5), name: 'Renomeado', color: 255 }
    })
    expect(roleIds()).toEqual(['a', 'b', 'everyone'])
    expect(useServerStore.getState().roles[0]).toMatchObject({ name: 'Renomeado', color: 255 })
  })

  it('role:delete tira o cargo da lista e dos membros', () => {
    send('role:delete', { server_id: 's1', role_id: 'b' })
    expect(roleIds()).toEqual(['a', 'everyone'])
    const members = useServerStore.getState().currentMembers
    expect(members.map((m) => m.role_ids)).toEqual([['a'], []])
  })

  it('role:reorder troca a lista inteira', () => {
    send('role:reorder', {
      server_id: 's1',
      roles: [role('a', 2), role('b', 1), role('everyone', 0, { is_default: true })]
    })
    expect(roleIds()).toEqual(['a', 'b', 'everyone'])
  })

  it('server:member:roles muda só os cargos daquele membro', () => {
    send('server:member:roles', { server_id: 's1', user_id: 'bia', role_ids: ['a'] })
    const members = useServerStore.getState().currentMembers
    expect(members.find((m) => m.user_id === 'bia')?.role_ids).toEqual(['a'])
    expect(members.find((m) => m.user_id === 'ana')?.role_ids).toEqual(['a', 'b'])
  })

  it('eventos de outro servidor não mexem no aberto', () => {
    send('role:delete', { server_id: 'outro', role_id: 'b' })
    send('server:member:roles', { server_id: 'outro', user_id: 'ana', role_ids: [] })
    send('role:create', { server_id: 'outro', role: role('x', 9) })
    expect(roleIds()).toEqual(['b', 'a', 'everyone'])
    expect(useServerStore.getState().currentMembers[0].role_ids).toEqual(['a', 'b'])
  })

  it('payload incompleto não quebra', () => {
    expect(send('role:create', { server_id: 's1' })).toBe(true)
    expect(send('role:delete', {})).toBe(true)
    expect(send('role:reorder', { server_id: 's1', roles: 'x' })).toBe(true)
    expect(roleIds()).toEqual(['b', 'a', 'everyone'])
  })
})

describe('eventos de permissão e remoção', () => {
  it('server:permissions:invalidate avisa quem decide a tela', () => {
    send('server:permissions:invalidate', { server_id: 's1' })
    expect(deps.onPermissionsChanged).toHaveBeenCalledWith('s1')
  })

  it('server:removed passa o motivo', () => {
    send('server:removed', { server_id: 's1', user_id: 'eu', reason: 'ban' })
    expect(deps.onServerRemoved).toHaveBeenCalledWith('s1', 'ban')
  })

  it('devolve false para eventos que não são deste tipo', () => {
    expect(send('message:create', { server_id: 's1' })).toBe(false)
    expect(send('server:update', { server_id: 's1' })).toBe(false)
    expect(deps.onPermissionsChanged).not.toHaveBeenCalled()
  })
})

describe('removedMessage', () => {
  it('avisa expulsão e banimento com o nome do servidor', () => {
    expect(removedMessage('kick', 'Salinha')).toBe('Você foi expulso de “Salinha”.')
    expect(removedMessage('ban', 'Salinha')).toBe('Você foi banido de “Salinha”.')
  })

  it('funciona sem o nome', () => {
    expect(removedMessage('kick', undefined)).toBe('Você foi expulso do servidor.')
  })

  it('quem saiu sozinho não precisa de aviso', () => {
    expect(removedMessage('leave', 'Salinha')).toBeNull()
    expect(removedMessage('', 'Salinha')).toBeNull()
  })
})

describe('server:member:nickname', () => {
  const nickOf = (userId: string): string | null | undefined =>
    useServerStore.getState().currentMembers.find((m) => m.user_id === userId)?.nickname

  it('troca o apelido no servidor aberto (lista e mapa)', () => {
    expect(
      send('server:member:nickname', { server_id: 's1', user_id: 'ana', nickname: 'Aninha' })
    ).toBe(true)
    expect(nickOf('ana')).toBe('Aninha')
    expect(useServerStore.getState().nicknames.s1).toEqual({ ana: 'Aninha', bia: 'Bibi' })
  })

  it('nickname nulo tira o apelido', () => {
    send('server:member:nickname', { server_id: 's1', user_id: 'bia', nickname: null })
    expect(nickOf('bia')).toBeNull()
    expect(useServerStore.getState().nicknames.s1).toEqual({})
  })

  it('outro servidor: só o mapa dele muda (overlay da call de lá)', () => {
    send('server:member:nickname', { server_id: 'outro', user_id: 'ana', nickname: 'Ana de lá' })
    expect(nickOf('ana')).toBeUndefined()
    expect(useServerStore.getState().nicknames).toEqual({
      s1: { bia: 'Bibi' },
      outro: { ana: 'Ana de lá' }
    })
  })

  it('payload incompleto não quebra', () => {
    expect(send('server:member:nickname', { server_id: 's1' })).toBe(true)
    expect(useServerStore.getState().nicknames.s1).toEqual({ bia: 'Bibi' })
  })
})
