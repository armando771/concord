import type { Proposal, ProposalStatus } from '../../api/proposals'
import {
  canDeleteProposal,
  canVote,
  proposalImageSrc,
  timeLeftLabel,
  yesPercent
} from '../../lib/proposals'
import Avatar from '../Avatar'
import Button from '../Button'
import MoveSelect from './MoveSelect'

interface ProposalCardProps {
  proposal: Proposal
  now: number
  meId: string | null
  isTech: boolean
  busy: boolean
  /** Abre a versão expandida (modal) do card. */
  onOpen: () => void
  onVote: (approve: boolean) => void
  onRemoveVote: () => void
  onMove: (status: ProposalStatus) => void
  onDelete: () => void
  /** Clone que segue o mouse no arrasto: sem botões e sem abrir o modal. */
  overlay?: boolean
}

function ProposalCard({
  proposal: p,
  now,
  meId,
  isTech,
  busy,
  onOpen,
  onVote,
  onRemoveVote,
  onMove,
  onDelete,
  overlay = false
}: ProposalCardProps): React.JSX.Element {
  const open = canVote(p, now) && !overlay
  const total = p.yes_votes + p.no_votes
  const percent = yesPercent(p)
  const canDelete = canDeleteProposal(p, meId, isTech) && !overlay
  const firstImage = p.images[0]
  // Os controles de dentro do card não abrem o modal.
  const stop = (e: React.SyntheticEvent): void => e.stopPropagation()

  return (
    <article
      role={overlay ? undefined : 'button'}
      tabIndex={overlay ? undefined : 0}
      aria-label={overlay ? undefined : `Abrir proposta: ${p.title}`}
      aria-hidden={overlay || undefined}
      onClick={overlay ? undefined : onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={`flex flex-col gap-3 rounded-xl border p-3 focus-visible:outline-2 focus-visible:outline-violet-400 ${
        overlay
          ? 'rotate-2 cursor-grabbing border-violet-400/60 bg-[#1b1d2b] shadow-2xl shadow-black/60'
          : 'cursor-pointer border-white/6 bg-white/3 transition-colors hover:bg-white/5'
      }`}
    >
      {firstImage && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/30">
          <img
            src={proposalImageSrc(firstImage.url)}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover"
          />
          {p.images.length > 1 && (
            <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              +{p.images.length - 1}
            </span>
          )}
        </div>
      )}
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
        {p.comment_count > 0 && (
          <span
            className="shrink-0 text-gray-400"
            title={`${p.comment_count} ${p.comment_count === 1 ? 'comentário' : 'comentários'}`}
          >
            💬 {p.comment_count}
          </span>
        )}
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
        <div className="flex gap-2" onClick={stop}>
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

      {p.github_issue_url && !overlay && (
        <a
          href={p.github_issue_url}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          className="text-xs font-medium text-violet-300 hover:text-violet-200 hover:underline"
        >
          Issue #{p.github_issue_number} no GitHub
        </a>
      )}

      {!overlay && (isTech || canDelete) && (
        <div
          className="flex flex-wrap items-center gap-2 border-t border-white/6 pt-2"
          onClick={stop}
        >
          {isTech && <MoveSelect status={p.status} disabled={busy} onMove={onMove} />}
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
