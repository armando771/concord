import { describe, expect, it } from 'vitest'
import {
  assignableRoles,
  moveRoleId,
  removeRole,
  sortRoles,
  stripRoleFromMembers,
  upsertRole
} from './roleList'
import type { Role } from './permissions'

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

const everyone = role('everyone', 0, { is_default: true })
const list = [everyone, role('a', 1), role('b', 3), role('c', 2)]

describe('lista de cargos', () => {
  it('sortRoles põe o mais alto primeiro e o @everyone por último', () => {
    expect(sortRoles(list).map((r) => r.id)).toEqual(['b', 'c', 'a', 'everyone'])
  })

  it('sortRoles não muda a lista original', () => {
    const copy = [...list]
    sortRoles(list)
    expect(list).toEqual(copy)
  })

  it('upsertRole inclui na posição certa', () => {
    const next = upsertRole(sortRoles(list), role('novo', 4))
    expect(next.map((r) => r.id)).toEqual(['novo', 'b', 'c', 'a', 'everyone'])
  })

  it('upsertRole atualiza e reordena quem já existe', () => {
    const next = upsertRole(sortRoles(list), { ...role('a', 5), name: 'Renomeado' })
    expect(next.map((r) => r.id)).toEqual(['a', 'b', 'c', 'everyone'])
    expect(next[0].name).toBe('Renomeado')
    expect(next).toHaveLength(4)
  })

  it('removeRole tira só o cargo', () => {
    expect(removeRole(list, 'b').map((r) => r.id)).toEqual(['everyone', 'a', 'c'])
    expect(removeRole(list, 'nada')).toHaveLength(4)
  })
})

describe('stripRoleFromMembers', () => {
  const members = [
    { user_id: 'x', role_ids: ['a', 'b'] },
    { user_id: 'y', role_ids: ['b'] },
    { user_id: 'z' }
  ]

  it('tira o cargo de quem tinha', () => {
    const next = stripRoleFromMembers(members, 'b')
    expect(next.map((m) => m.role_ids)).toEqual([['a'], [], undefined])
  })

  it('devolve a mesma lista quando ninguém tinha', () => {
    expect(stripRoleFromMembers(members, 'nada')).toBe(members)
  })
})

describe('assignableRoles', () => {
  it('o dono dá qualquer cargo, menos o @everyone', () => {
    const got = assignableRoles(list, { isOwner: true, actorHighest: 0, canManageRoles: true })
    expect(got.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('os demais só os abaixo do seu mais alto', () => {
    const got = assignableRoles(list, { isOwner: false, actorHighest: 3, canManageRoles: true })
    expect(got.map((r) => r.id)).toEqual(['c', 'a'])
    const low = assignableRoles(list, { isOwner: false, actorHighest: 2, canManageRoles: true })
    expect(low.map((r) => r.id)).toEqual(['a'])
  })

  it('sem MANAGE_ROLES não dá nenhum', () => {
    expect(
      assignableRoles(list, { isOwner: true, actorHighest: 9, canManageRoles: false })
    ).toEqual([])
  })
})

describe('moveRoleId', () => {
  const ids = ['b', 'c', 'a']

  it('move para a posição do alvo', () => {
    expect(moveRoleId(ids, 'a', 'b')).toEqual(['a', 'b', 'c'])
    expect(moveRoleId(ids, 'b', 'a')).toEqual(['c', 'a', 'b'])
  })

  it('ids desconhecidos ou iguais não mudam nada', () => {
    expect(moveRoleId(ids, 'a', 'a')).toBe(ids)
    expect(moveRoleId(ids, 'x', 'a')).toBe(ids)
    expect(moveRoleId(ids, 'a', 'x')).toBe(ids)
  })
})
