import type { ProposalAssignee } from '../api/proposals'
import Avatar from '../../../shared/ui/Avatar'

/** Quem do time está com o card ("Com Fulano"). */
function AssigneeBadge({
  assignee,
  meId
}: {
  assignee: ProposalAssignee
  meId: string | null
}): React.JSX.Element {
  const mine = assignee.id === meId
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        mine
          ? 'border-violet-400/40 bg-violet-500/15 text-violet-200'
          : 'border-subtle bg-fg/5 text-gray-300'
      }`}
      title={mine ? 'Este card está com você' : `Este card está com ${assignee.name}`}
    >
      <Avatar userId={assignee.id} name={assignee.name} avatarUrl={assignee.avatar_url} size={16} />
      <span className="truncate">{mine ? 'Com você' : `Com ${assignee.name}`}</span>
    </span>
  )
}

export default AssigneeBadge
