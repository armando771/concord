import type { Proposal, ProposalStatus } from '../../api/proposals'
import {
  canVote,
  NEXT_STATUSES,
  STATUS_ACTION_LABEL,
  timeLeftLabel,
  yesPercent
} from '../../lib/proposals'
import Avatar from '../Avatar'
import Button from '../Button'

interface ProposalCardProps {
  proposal: Proposal
  now: number
  meId: string | null
  isTech: boolean
  busy: boolean
  onVote: (approve: boolean) => void
  onRemoveVote: () => void
  onMove: (status: ProposalStatus) => void
  onDelete: () => void
}

function ProposalCard({
  proposal: p,
  now,
  meId,
  isTech,
  busy,
  onVote,
  onRemoveVote,
  onMove,
  onDelete
}: ProposalCardProps): React.JSX.Element {
  const open = canVote(p, now)
  const total = p.yes_votes + p.no_votes
  const percent = yesPercent(p)
  const moves = isTech ? (NEXT_STATUSES[p.status] ?? []) : []
  const canDelete = isTech || (meId === p.author_id && p.status === 'voting')

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-white/6 bg-white/3 p-3">
      <div className="min-w-0">
        <h3 className="wrap-break-word text-sm font-semibold leading-snug text-white">{p.title}</h3>
        {p.description && (
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap wrap-break-word text-xs text-gray-400">
            {p.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Avatar
          userId={p.author_id}
          name={p.author_name}
          avatarUrl={p.author_avatar_url}
          size={20}
        />
        <span className="min-w-0 truncate">{p.author_name}</span>
        {p.status === 'voting' && (
          <span className="ml-auto shrink-0 text-violet-300">
            {timeLeftLabel(p.voting_ends_at, now)}
          </span>
        )}
      </div>

      {(p.status === 'voting' || total > 0) && (
        <div className="flex flex-col gap-1.5">
          <div
            className="flex h-1.5 overflow-hidden rounded-full bg-white/10"
            role="img"
            aria-label={`${p.yes_votes} sim e ${p.no_votes} não`}
          >
            <div className="bg-discord-green transition-all" style={{ width: `${percent}%` }} />
            <div
              className="bg-discord-dnd transition-all"
              style={{ width: total === 0 ? '0%' : `${100 - percent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>{p.yes_votes} sim</span>
            <span>{p.no_votes} não</span>
          </div>
        </div>
      )}

      {open && (
        <div className="flex gap-2">
          <Button
            variant={p.my_vote === true ? 'success' : 'ghost'}
            className="flex-1"
            disabled={busy}
            aria-pressed={p.my_vote === true}
            onClick={() => (p.my_vote === true ? onRemoveVote() : onVote(true))}
          >
            Sim
          </Button>
          <Button
            variant={p.my_vote === false ? 'danger' : 'ghost'}
            className="flex-1"
            disabled={busy}
            aria-pressed={p.my_vote === false}
            onClick={() => (p.my_vote === false ? onRemoveVote() : onVote(false))}
          >
            Não
          </Button>
        </div>
      )}

      {p.github_issue_url && (
        <a
          href={p.github_issue_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-violet-300 hover:text-violet-200 hover:underline"
        >
          Issue #{p.github_issue_number} no GitHub
        </a>
      )}

      {(moves.length > 0 || canDelete) && (
        <div className="flex flex-wrap gap-2 border-t border-white/6 pt-2">
          {moves.map((status) => (
            <Button
              key={status}
              variant={status === 'rejected' ? 'danger' : 'secondary'}
              className="px-3 py-1 text-xs"
              disabled={busy}
              onClick={() => onMove(status)}
            >
              {STATUS_ACTION_LABEL[status]}
            </Button>
          ))}
          {canDelete && (
            <Button
              variant="ghost"
              className="ml-auto px-3 py-1 text-xs"
              disabled={busy}
              onClick={onDelete}
            >
              Excluir
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

export default ProposalCard
