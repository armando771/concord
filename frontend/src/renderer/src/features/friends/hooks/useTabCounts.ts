import { useFriendStore } from '../store/friendStore'
import { useInviteStore } from '../../servers/store/inviteStore'
import type { TabCounts } from '../lib/friendsTabs'

/** Números dos selos das abas: pedidos de amizade recebidos e convites de servidor. */
export function useTabCounts(): TabCounts {
  const pending = useFriendStore((s) => s.pending.filter((p) => p.direction === 'incoming').length)
  const invites = useInviteStore((s) => s.invites.length)
  return { pending, invites }
}
