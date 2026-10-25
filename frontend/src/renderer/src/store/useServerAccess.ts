import { useMemo } from 'react'
import { useAuthStore } from './authStore'
import { useServerStore } from './serverStore'
import { serverAccess, type ServerAccess } from '../lib/serverAccess'

/**
 * O que o usuário pode no servidor aberto (cargos, canais privados,
 * hierarquia). Recalcula quando cargos, membros ou canais mudam.
 */
export function useServerAccess(): ServerAccess {
  const ownerId = useServerStore((s) => s.currentServer?.owner_id)
  const members = useServerStore((s) => s.currentMembers)
  const roles = useServerStore((s) => s.roles)
  const channels = useServerStore((s) => s.channels)
  const meId = useAuthStore((s) => s.user?.id)

  return useMemo(
    () => serverAccess({ ownerId, meId, members, roles, channels }),
    [ownerId, meId, members, roles, channels]
  )
}
