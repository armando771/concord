// Como cada pessoa aparece na lista de membros do servidor: nome, @ e as cores
// de reserva (avatar sem foto e nome sem cargo colorido).

interface LookMember {
  user_id: string
  display_name?: string
  username?: string
}

interface LookMe {
  id: string
  display_name?: string
  username?: string
}

export interface MemberRowLook {
  displayName: string
  handle: string
  colorClass: string
  nameClass: string
}

/** Nome e @; sem os dados do membro (ainda carregando), vale o meu ou o genérico. */
function memberNames(m: LookMember, me: LookMe | null | undefined): [string, string] {
  const self = m.user_id === me?.id ? me : null
  const displayName = m.display_name ?? m.username ?? (self ? self.display_name : 'Membro')
  const handle = m.username ?? (self ? self.username : 'membro')
  return [displayName ?? 'Membro', handle ?? 'membro']
}

/**
 * Offline fica cinza; os demais, índigo. O dono não tem cor própria: vale a do
 * cargo dele, como para todo mundo.
 */
function memberTone(offline: boolean): [string, string] {
  return offline ? ['bg-gray-600', 'text-gray-400'] : ['bg-indigo-600', 'text-gray-200']
}

export function memberRowLook(
  m: LookMember,
  ctx: { me: LookMe | null | undefined; offline: boolean }
): MemberRowLook {
  const [displayName, handle] = memberNames(m, ctx.me)
  const [colorClass, nameClass] = memberTone(ctx.offline)
  return { displayName, handle, colorClass, nameClass }
}
