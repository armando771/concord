import { describe, expect, it } from 'vitest'
import { Perm, type Role } from './permissions'
import { canRemoveRole, memberRowAccess, nicknameNames } from './memberSettings'

const access = (perms: number, actOn = true) => ({
  can: (want: number) => (perms & want) === want,
  canActOnMember: () => actOn,
  canChangeNickname: () => false
})

describe('memberRowAccess', () => {
  it('expulsar e banir pedem a permissão e estar acima do membro', () => {
    const all = Perm.KICK_MEMBERS | Perm.BAN_MEMBERS
    expect(memberRowAccess(access(all), 'ana', { ownerId: 'dono' })).toMatchObject({
      kick: true,
      ban: true
    })
    expect(memberRowAccess(access(all, false), 'ana', { ownerId: 'dono' })).toMatchObject({
      kick: false,
      ban: false
    })
    expect(memberRowAccess(access(Perm.KICK_MEMBERS), 'ana', { ownerId: 'dono' }).ban).toBe(false)
  })

  it('sem Gerenciar cargos não dá nem tira cargo', () => {
    const row = memberRowAccess(access(0), 'ana', { ownerId: 'dono' })
    expect(row.giveRoles).toBe(false)
    expect(row.removeRoles).toBe(false)
  })

  it('com Gerenciar cargos dá e tira cargo dos membros', () => {
    const row = memberRowAccess(access(Perm.MANAGE_ROLES), 'ana', { ownerId: 'dono' })
    expect(row.giveRoles).toBe(true)
    expect(row.removeRoles).toBe(true)
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
