import { describe, expect, it } from 'vitest'
import { Perm, canEditRolesOf, type Role } from './permissions'
import { canRemoveRole, memberRowAccess, nicknameNames } from './memberSettings'

const access = (perms: number, actOn = true, me = 'mod') => ({
  can: (want: number) => (perms & want) === want,
  canActOnMember: () => actOn,
  canChangeNickname: () => false,
  canEditRolesOf: (id: string) => canEditRolesOf('dono', me, id)
})

describe('memberRowAccess', () => {
  it('expulsar e banir pedem a permissão e estar acima do membro', () => {
    const all = Perm.KICK_MEMBERS | Perm.BAN_MEMBERS
    expect(memberRowAccess(access(all), 'ana')).toMatchObject({
      kick: true,
      ban: true
    })
    expect(memberRowAccess(access(all, false), 'ana')).toMatchObject({
      kick: false,
      ban: false
    })
    expect(memberRowAccess(access(Perm.KICK_MEMBERS), 'ana').ban).toBe(false)
  })

  it('sem Gerenciar cargos não dá nem tira cargo', () => {
    expect(memberRowAccess(access(0), 'ana').editRoles).toBe(false)
  })

  it('com Gerenciar cargos dá e tira cargo dos membros e de si mesmo', () => {
    expect(memberRowAccess(access(Perm.MANAGE_ROLES), 'ana').editRoles).toBe(true)
    expect(memberRowAccess(access(Perm.MANAGE_ROLES), 'mod').editRoles).toBe(true)
  })

  // Regressão da issue #331.
  it('os cargos do dono só o dono mexe', () => {
    expect(memberRowAccess(access(Perm.MANAGE_ROLES, true, 'dono'), 'dono').editRoles).toBe(true)
    expect(memberRowAccess(access(Perm.MANAGE_ROLES), 'dono').editRoles).toBe(false)
  })
})

describe('canRemoveRole', () => {
  const vip = { id: 'vip' } as Role
  it('só tira cargo atribuível por quem pode tirar', () => {
    expect(canRemoveRole(true, [vip], 'vip')).toBe(true)
    expect(canRemoveRole(true, [vip], 'mod')).toBe(false)
    expect(canRemoveRole(false, [vip], 'vip')).toBe(false)
  })
})

describe('nicknameNames', () => {
  it('sem apelido vale null; o nome de exibição cai para o @ e depois para o nome da lista', () => {
    expect(nicknameNames({ nickname: 'Aninha', display_name: 'Ana' }, 'x')).toEqual({
      nickname: 'Aninha',
      displayName: 'Ana'
    })
    expect(nicknameNames({ username: 'ana' }, 'x')).toEqual({ nickname: null, displayName: 'ana' })
    expect(nicknameNames({}, 'Ana')).toEqual({ nickname: null, displayName: 'Ana' })
  })
})
