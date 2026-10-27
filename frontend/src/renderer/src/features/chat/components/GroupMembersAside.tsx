import type { ConversationOtherUser, ConversationSummary } from '../api/conversations'
import GroupMemberRow from './GroupMemberRow'

/** Coluna de participantes do grupo; só o dono remove, e ninguém remove a si mesmo. */
function GroupMembersAside({
  conv,
  meId,
  onRemove
}: {
  conv: ConversationSummary
  meId: string | undefined
  onRemove: (member: ConversationOtherUser) => void
}): React.JSX.Element {
  const isOwner = conv.owner_id === meId
  return (
    <aside className="absolute inset-y-0 right-0 z-10 w-60 shrink-0 overflow-y-auto border-l border-subtle bg-secondary px-2 py-4 shadow-2xl lg:static lg:z-auto lg:shadow-none">
      <p className="px-2 pb-1 text-ds-sm font-medium text-gray-400">
        Membros — {conv.members.length}
      </p>
      {conv.members.map((m) => (
        <GroupMemberRow
          key={m.id}
          member={m}
          isOwner={m.id === conv.owner_id}
          canRemove={isOwner && m.id !== meId}
          onRemove={() => onRemove(m)}
        />
      ))}
    </aside>
  )
}

export default GroupMembersAside
