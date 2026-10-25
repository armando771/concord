import { useState } from 'react'
import type { Proposal, ProposalStatus } from '../../api/proposals'
import {
  BOARD_COLUMNS,
  canDeleteProposal,
  canEditProposal,
  canVote,
  proposalImageSrc,
  REJECTED_COLUMN,
  timeLeftLabel,
  yesPercent
} from '../../lib/proposals'
import Avatar from '../Avatar'
import Button from '../Button'
import MediaLightbox from '../chat/MediaLightbox'
import Modal from '../Modal'
import MoveSelect from './MoveSelect'
import NewProposalModal from './NewProposalModal'
import ProposalComments from './ProposalComments'

interface ProposalDetailModalProps {
  proposal: Proposal
  now: number
  meId: string | null
  isTech: boolean
  busy: boolean
  onVote: (approve: boolean) => void
  onRemoveVote: () => void
  onMove: (status: ProposalStatus) => void
  onDelete: () => void
  onClose: () => void
}

const columnTitle = (status: ProposalStatus): string =>
  [...BOARD_COLUMNS, REJECTED_COLUMN].find((c) => c.status === status)?.title ?? status

/** Versão expandida do card: texto inteiro, imagens, votação, ações e comentários. */
function ProposalDetailModal({
  proposal: p,
  now,
  meId,
  isTech,
  busy,
  onVote,
  onRemoveVote,
  onMove,
  onDelete,
  onClose
}: ProposalDetailModalProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [zoomed, setZoomed] = useState<string | null>(null)
  const open = canVote(p, now)
  const total = p.yes_votes + p.no_votes
  const percent = yesPercent(p)
  const canEdit = canEditProposal(p, meId, isTech, now)
  const canDelete = canDeleteProposal(p, meId, isTech)

  return (
    <>
      <Modal open title={p.title} onClose={onClose} wide>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <Avatar
              userId={p.author_id}
              name={p.author_name}
              avatarUrl={p.author_avatar_url}
              size={24}
            />
            <span className="font-medium text-gray-200">{p.author_name}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300">
              {columnTitle(p.status)}
            </span>
            {p.status === 'voting' && (
              <span className="text-violet-300">{timeLeftLabel(p.voting_ends_at, now)}</span>
            )}
            {p.edited_at && <span className="text-gray-500">(editada)</span>}
          </div>

          {p.description && (
            <p className="whitespace-pre-wrap wrap-break-word text-sm text-gray-200">
              {p.description}
            </p>
          )}

          {p.images.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {p.images.map((img, i) => (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => setZoomed(proposalImageSrc(img.url))}
                    aria-label={`Ampliar imagem ${i + 1}`}
                    className="block aspect-video w-full cursor-zoom-in overflow-hidden rounded-lg border border-white/10 bg-black/30"
                  >
                    <img
                      src={proposalImageSrc(img.url)}
                      alt={`Imagem ${i + 1} da proposta`}
                      loading="lazy"
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(p.status === 'voting' || total > 0) && (
            <div className="flex flex-col gap-1.5">
              <div
                className="flex h-2 overflow-hidden rounded-full bg-white/10"
                role="img"
                aria-label={`${p.yes_votes} sim e ${p.no_votes} não`}
              >
                <div className="bg-discord-green transition-all" style={{ width: `${percent}%` }} />
                <div
                  className="bg-discord-dnd transition-all"
                  style={{ width: total === 0 ? '0%' : `${100 - percent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
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

          {(p.github_issue_url || canEdit || canDelete || isTech) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/6 pt-3">
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
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {isTech && <MoveSelect status={p.status} disabled={busy} onMove={onMove} />}
                {canEdit && (
                  <Button
                    variant="secondary"
                    className="px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={() => setEditing(true)}
                  >
                    Editar
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    className="px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={onDelete}
                  >
                    Excluir
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-white/6 pt-4">
            <ProposalComments proposalId={p.id} meId={meId} isTech={isTech} />
          </div>
        </div>
      </Modal>

      <NewProposalModal open={editing} proposal={p} onClose={() => setEditing(false)} />
      {zoomed && <MediaLightbox src={zoomed} alt="Imagem da proposta" onClose={() => setZoomed(null)} />}
    </>
  )
}

export default ProposalDetailModal
