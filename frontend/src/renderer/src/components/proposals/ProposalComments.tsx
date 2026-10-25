import { useEffect, useState } from 'react'
import type { ProposalComment } from '../../api/proposals'
import { canDeleteComment, canEditComment, MAX_COMMENT } from '../../lib/proposals'
import { useProposalStore } from '../../store/proposalStore'
import { showToast } from '../../store/toastStore'
import Avatar from '../Avatar'
import Button from '../Button'
import MessageText from '../chat/MessageText'
import CommentComposer from './CommentComposer'

const NO_COMMENTS: ProposalComment[] = []

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function CommentRow({
  comment,
  proposalId,
  meId,
  isTech
}: {
  comment: ProposalComment
  proposalId: string
  meId: string | null
  isTech: boolean
}): React.JSX.Element {
  const editComment = useProposalStore((s) => s.editComment)
  const removeComment = useProposalStore((s) => s.removeComment)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [busy, setBusy] = useState(false)

  const save = async (): Promise<void> => {
    const body = draft.trim()
    if (!body || busy) return
    if (body === comment.body) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await editComment(proposalId, comment.id, body)
      setEditing(false)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível editar o comentário.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await removeComment(proposalId, comment.id)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível apagar o comentário.')
      setBusy(false)
    }
  }

  return (
    <li className="flex gap-2.5">
      <Avatar
        userId={comment.author_id}
        name={comment.author_name}
        avatarUrl={comment.author_avatar_url}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-semibold text-white">{comment.author_name}</span>
          <span className="text-gray-500">{formatTime(comment.created_at)}</span>
          {comment.edited_at && <span className="text-gray-500">(editado)</span>}
          <span className="ml-auto flex gap-2">
            {canEditComment(comment, meId) && !editing && (
              <button
                type="button"
                className="cursor-pointer text-gray-400 hover:text-white"
                onClick={() => {
                  setDraft(comment.body)
                  setEditing(true)
                }}
              >
                Editar
              </button>
            )}
            {canDeleteComment(comment, meId, isTech) && (
              <button
                type="button"
                disabled={busy}
                className="cursor-pointer text-gray-400 hover:text-red-400 disabled:opacity-50"
                onClick={() => void remove()}
              >
                Apagar
              </button>
            )}
          </span>
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <textarea
              value={draft}
              maxLength={MAX_COMMENT}
              rows={2}
              aria-label="Editar comentário"
              autoFocus
              className="glass-input w-full resize-none rounded-lg px-3 py-2 text-ds-sm text-white"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void save()
                } else if (e.key === 'Escape') {
                  setEditing(false)
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-1 text-xs"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="px-3 py-1 text-xs"
                disabled={busy || draft.trim().length === 0}
                onClick={() => void save()}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <MessageText content={comment.body} everyone={null} />
        )}
      </div>
    </li>
  )
}

/** Conversa do card: lista (ao vivo pelo tempo real) e caixa para comentar. */
function ProposalComments({
  proposalId,
  meId,
  isTech
}: {
  proposalId: string
  meId: string | null
  isTech: boolean
}): React.JSX.Element {
  const comments = useProposalStore((s) => s.commentsByProposal[proposalId]) ?? NO_COMMENTS
  const loaded = useProposalStore((s) => s.commentsByProposal[proposalId] != null)
  const loadComments = useProposalStore((s) => s.loadComments)
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const failed = failedFor === proposalId

  useEffect(() => {
    loadComments(proposalId).catch(() => setFailedFor(proposalId))
  }, [proposalId, loadComments])

  return (
    <section aria-label="Comentários" className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-white">
        Comentários{loaded && comments.length > 0 ? ` (${comments.length})` : ''}
      </h3>
      {!loaded ? (
        <p className="text-xs text-gray-400">
          {failed ? 'Não foi possível carregar os comentários.' : 'Carregando comentários...'}
        </p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-500">Ninguém comentou ainda. Comece a conversa!</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} proposalId={proposalId} meId={meId} isTech={isTech} />
          ))}
        </ul>
      )}
      <CommentComposer proposalId={proposalId} />
    </section>
  )
}

export default ProposalComments
