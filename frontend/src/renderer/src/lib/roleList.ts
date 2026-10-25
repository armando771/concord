import type { Role } from './permissions'

/** Do cargo mais alto para o mais baixo (o @everyone, posição 0, por último). */
export function sortRoles(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => b.position - a.position)
}

/** Troca (ou inclui) o cargo na lista, mantendo a ordem da hierarquia. */
export function upsertRole(roles: Role[], role: Role): Role[] {
  const exists = roles.some((r) => r.id === role.id)
  const next = exists
    ? roles.map((r) => (r.id === role.id ? { ...r, ...role } : r))
    : [...roles, role]
  return sortRoles(next)
}

export function removeRole(roles: Role[], roleId: string): Role[] {
  return roles.filter((r) => r.id !== roleId)
}

/** Tira o cargo de todos os membros que o tinham (cargo apagado). */
export function stripRoleFromMembers<T extends { role_ids?: string[] }>(
  members: T[],
  roleId: string
): T[] {
  let changed = false
  const next = members.map((m) => {
    if (!m.role_ids?.includes(roleId)) return m
    changed = true
    return { ...m, role_ids: m.role_ids.filter((id) => id !== roleId) }
  })
  return changed ? next : members
}

/**
 * Cargos que o ator pode dar ou tirar de outros: os abaixo do seu mais alto (o
 * dono, todos), sem o @everyone.
 */
export function assignableRoles(
  roles: Role[],
  opts: { isOwner: boolean; actorHighest: number; canManageRoles: boolean }
): Role[] {
  if (!opts.canManageRoles) return []
  return sortRoles(
    roles.filter((r) => !r.is_default && (opts.isOwner || opts.actorHighest > r.position))
  )
}

/**
 * Ordem nova depois de arrastar um cargo: `ids` são os ids (sem o @everyone) na
 * ordem atual; devolve a lista com `moved` na posição de `target`.
 */
export function moveRoleId(ids: string[], moved: string, target: string): string[] {
  const from = ids.indexOf(moved)
  const to = ids.indexOf(target)
  if (from < 0 || to < 0 || from === to) return ids
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
