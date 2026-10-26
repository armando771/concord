import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../../chat/store/chatStore'
import { useFriendStore } from '../../friends/store/friendStore'
import { useInviteStore } from '../store/inviteStore'
import { useProposalStore } from '../../proposals/store/proposalStore'
import { badgeCount } from '../../proposals/lib/proposals'
import { dmUnreadTotal } from '../lib/railHome'

// Números dos selos do início (DMs + pedidos + convites de servidor) e das propostas na barra lateral.
export function useRailBadges(onProposals: boolean): { dmUnread: number; proposalsBadge: number } {
  const meId = useAuthStore((s) => s.user?.id ?? null)
  const proposals = useProposalStore((s) => s.proposals)
  const proposalMentions = useProposalStore((s) => s.pendingMentions)
  const proposalsSeenAt = useProposalStore((s) => s.lastSeenAt)
  const unreadByRoom = useChatStore((s) => s.unreadByRoom)
  const conversations = useChatStore((s) => s.conversations)
  const incomingRequests = useFriendStore(
    (s) => s.pending.filter((p) => p.direction === 'incoming').length
  )
  const serverInvites = useInviteStore((s) => s.invites.length)

  return {
    dmUnread: dmUnreadTotal(conversations, unreadByRoom, incomingRequests, serverInvites),
    // Propostas novas e menções desde a última visita; com o quadro aberto não mostra nada.
    proposalsBadge: onProposals ? 0 : badgeCount(proposals, proposalMentions, proposalsSeenAt, meId)
  }
}
