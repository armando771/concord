import { Perm, type Role } from './permissions'
import type { ServerAccess } from './serverAccess'

/** O que a pessoa pode fazer com um membro na aba Membros das configurações. */
export interface MemberRowAccess {
  nickname: boolean
  kick: boolean
  ban: boolean
  /**
   * O "+" e o × dos cargos (cada cargo ainda precisa estar em `assignable`).
   * Os cargos do dono só ele mesmo mexe.
   */
  editRoles: boolean
}

type RowAccessSource = Pick<
  ServerAccess,
  'can' | 'canActOnMember' | 'canChangeNickname' | 'canEditRolesOf'
>

/** Expulsar e banir seguem a hierarquia; dar/tirar cargo pede Gerenciar cargos. */
export function memberRowAccess(access: RowAccessSource, userId: string): MemberRowAccess {
  const canAct = access.canActOnMember(userId)
  return {
    nickname: access.canChangeNickname(userId),
    kick: canAct && access.can(Perm.KICK_MEMBERS),
    ban: canAct && access.can(Perm.BAN_MEMBERS),
    editRoles: access.can(Perm.MANAGE_ROLES) && access.canEditRolesOf(userId)
  }
}

/** O × só aparece se a pessoa pode mexer nos cargos e este cargo é atribuível por ela. */
export function canRemoveRole(editRoles: boolean, assignable: Role[], roleId: string): boolean {
  return editRoles && assignable.some((r) => r.id === roleId)
}

/** Apelido atual e o nome que aparece sem apelido, para o modal de apelido. */
export function nicknameNames(
  member: { nickname?: string | null; display_name?: string; username?: string },
  name: string
): { nickname: string | null; displayName: string } {
  return {
    nickname: member.nickname ?? null,
    displayName: member.display_name || member.username || name
  }
}
