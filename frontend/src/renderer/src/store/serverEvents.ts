import type { WsEvent } from '../api/ws'
import type { Role } from '../lib/permissions'
import { useServerStore } from './serverStore'
import { useInviteCodeStore } from './inviteCodeStore'
import { normalizeInviteCode } from '../lib/inviteLink'

/** Como o evento mudou o que a pessoa vê (quem chama decide o que fazer na tela). */
export interface ServerEventDeps {
  /** Saiu, foi expulso ou banido do servidor (reason: "leave", "kick" ou "ban"). */
  onServerRemoved: (serverId: string, reason: string) => void
  /** Cargos, cargos de membros ou sobrescritas de canal mudaram. */
  onPermissionsChanged: (serverId: string) => void
}

/** Texto do aviso quando a pessoa perde o servidor (sem aviso se ela mesma saiu). */
export function removedMessage(reason: string, serverName: string | undefined): string | null {
  const name = serverName ? `“${serverName}”` : 'do servidor'
  if (reason === 'kick') return `Você foi expulso ${serverName ? `de ${name}` : 'do servidor'}.`
  if (reason === 'ban') return `Você foi banido ${serverName ? `de ${name}` : 'do servidor'}.`
  return null
}

/**
 * Eventos de cargos e permissões do servidor. Devolve true se o evento era
 * deste tipo (e já foi tratado).
 */
export function handleServerRoleEvent(event: WsEvent, deps: ServerEventDeps): boolean {
  const payload = (event.payload ?? {}) as Record<string, unknown>
  const serverId = payload.server_id as string | undefined
  const store = useServerStore.getState()

  switch (event.type) {
    case 'role:create':
    case 'role:update': {
      const role = payload.role as Role | undefined
      if (serverId && role) store.upsertLocalRole(serverId, role)
      return true
    }
    case 'role:delete': {
      const roleId = payload.role_id as string | undefined
      if (serverId && roleId) store.removeLocalRole(serverId, roleId)
      return true
    }
    case 'role:reorder': {
      const roles = payload.roles as Role[] | undefined
      if (serverId && Array.isArray(roles)) store.setRoles(serverId, roles)
      return true
    }
    case 'server:member:roles': {
      const userId = payload.user_id as string | undefined
      const roleIds = payload.role_ids as string[] | undefined
      if (serverId && userId) store.setMemberRoleIds(serverId, userId, roleIds ?? [])
      return true
    }
    case 'server:permissions:invalidate': {
      if (serverId) deps.onPermissionsChanged(serverId)
      return true
    }
    case 'server:invite_code': {
      // Alguém gerou um link novo (só chega a quem pode convidar).
      const code = normalizeInviteCode(String(payload.code ?? ''))
      if (serverId && code) useInviteCodeStore.getState().set(serverId, code)
      return true
    }
    case 'server:removed': {
      if (serverId) deps.onServerRemoved(serverId, (payload.reason as string | undefined) ?? '')
      return true
    }
    default:
      return false
  }
}
