import DmCallView from '../../call/components/DmCallView'
import { ComposerSkeleton, MessageListSkeleton } from '../../../shared/ui/skeleton/layouts'
import { useInCallWith } from '../hooks/useInCallWith'
import type { DmAccess } from '../lib/dmAccess'
import type { DmPeer } from '../lib/dmPeer'
import ChatPane from './ChatPane'
import SearchResultsPanel from './SearchResultsPanel'

interface DmMessagesProps {
  userId: string | undefined
  conversationId: string | null
  error: string | null
  peer: DmPeer
  access: DmAccess
}

/** Corpo da DM: o chat (com a chamada por cima, se houver), o erro ou o carregando. */
function DmMessages({
  userId,
  conversationId,
  error,
  peer,
  access
}: DmMessagesProps): React.JSX.Element {
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-ds-md text-gray-400">
        <p>{error}</p>
      </div>
    )
  }
  if (!conversationId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <MessageListSkeleton label="Abrindo conversa…" />
        </div>
        <ComposerSkeleton />
      </div>
    )
  }
  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <DmChatPane userId={userId} conversationId={conversationId} peer={peer} access={access} />
      </div>
      <SearchResultsPanel scope={{ kind: 'conversation', id: conversationId }} />
    </div>
  )
}

function DmChatPane({
  userId,
  conversationId,
  peer,
  access
}: Omit<DmMessagesProps, 'conversationId' | 'error'> & {
  conversationId: string
}): React.JSX.Element {
  const inCallWithUser = useInCallWith(userId)
  const pane = (
    <ChatPane
      room={`conversation:${conversationId}`}
      placeholder={peer.placeholder}
      mentionable={peer.mentionable}
      disabledReason={access.disabledReason}
      permissions={access.permissions}
    />
  )
  return inCallWithUser ? <DmCallView>{pane}</DmCallView> : pane
}

export default DmMessages
