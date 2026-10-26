import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/client'
import type { ProposalComment } from '../api/proposals'
import { copyText } from '../../../shared/lib/clipboard'
import {
  canDeleteComment,
  canEditComment,
  commentPreview,
  hasReacted,
  MAX_COMMENT
} from '../lib/proposals'
import { useProposalStore } from '../store/proposalStore'
import { showToast } from '../../../shared/store/toastStore'
import Avatar from '../../../shared/ui/Avatar'
import Button from '../../../shared/ui/Button'
import EmotePickerPopover from '../../chat/components/EmotePickerPopover'
import MessageActionsBar from '../../chat/components/MessageActionsBar'
import MessageAttachments from '../../chat/components/MessageAttachments'
import MessageText from '../../chat/components/MessageText'
import ReactionChips from '../../chat/components/ReactionChips'
import ReplyReference from '../../chat/components/ReplyReference'
import CommentComposer from './CommentComposer'
import { CommentListSkeleton } from '../../../shared/ui/skeleton/layouts'

const NO_COMMENTS: ProposalComment[] = []

/** Quanto tempo o comentário fica destacado depois de "ir até a resposta". */
const HIGHLIGHT_MS = 1800

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function reactError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'too_many_reactions') return 'Esse comentário já tem emojis demais.'
    if (err.code === 'email_not_verified') return 'Confirme seu e-mail para reagir.'
  }
  return err instanceof Error && err.message ? err.message : 'Não foi possível reagir.'
}

function CommentRow({
  comment,
  proposalId,
  meId,
  isTech,
  highlighted,
  onReply,
  onJump
}: {
  comment: ProposalComment
  proposalId: string
  meId: string | null
  isTech: boolean
  highlighted: boolean
  onReply: () => void
  onJump: (commentId: string) => void
}): React.JSX.Element {
  const editComment = useProposalStore((s) => s.editComment)
  const removeComment = useProposalStore((s) => s.removeComment)
  const reactToComment = useProposalStore((s) => s.reactToComment)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [busy, setBusy] = useState(false)
  const [hover, setHover] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const hasReplyReference = Boolean(comment.reply_to_id || comment.reply_to)
  const hasAttachments = comment.attachments.length > 0

  const save = async (): Promise<void> => {
    const body = draft.trim()
    // Só quem tem anexo pode ficar sem texto.
    if ((!body && !hasAttachments) || busy) return
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

  const react = async (emoji: string): Promise<void> => {
    try {
      await reactToComment(proposalId, comment.id, emoji, !hasReacted(comment, meId, emoji))
    } catch (err) {
      showToast.error(reactError(err))
    }
  }

  return (
    <li
      id={`comment-${comment.id}`}
      data-comment
      className={`group relative flex flex-col gap-1 rounded-md px-2 py-1.5 transition-colors ${
        highlighted ? 'bg-brand/20 ring-1 ring-brand/50' : 'hover:bg-fg/3'
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hasReplyReference && (
        <ReplyReference
          authorName={comment.reply_to ? comment.reply_to.author_name : null}
          content={comment.reply_to ? commentPreview(comment.reply_to) : ''}
          emptyLabel="📎 Anexo"
          onJump={() => comment.reply_to && onJump(comment.reply_to.id)}
        />
      )}
      <div className="flex gap-2.5">
        <Avatar
          userId={comment.author_id}
          name={comment.author_name}
          avatarUrl={comment.author_avatar_url}
          size={32}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <span className="font-semibold text-strong">{comment.author_name}</span>
            <span className="text-gray-500">{formatTime(comment.created_at)}</span>
            {comment.edited_at && <span className="text-gray-500">(editado)</span>}
          </div>
          {editing ? (
            <div className="mt-1 flex flex-col gap-2">
              <textarea
                value={draft}
                maxLength={MAX_COMMENT}
                rows={2}
                aria-label="Editar comentário"
                autoFocus
                className="glass-input w-full resize-none rounded-lg px-3 py-2 text-ds-sm text-strong"
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
                  disabled={busy || (draft.trim().length === 0 && !hasAttachments)}
                  onClick={() => void save()}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            comment.body && <MessageText content={comment.body} everyone={null} />
          )}
          {hasAttachments && <MessageAttachments attachments={comment.attachments} />}
          <ReactionChips
            reactions={comment.reactions}
            meId={meId ?? undefined}
            canReact
            onReact={(emoji) => void react(emoji)}
            onOpenPicker={() => setPickerOpen((v) => !v)}
          />
        </div>
      </div>

      {(hover || pickerOpen) && !editing && (
        <MessageActionsBar
          canReact
          onReact={(emoji) => void react(emoji)}
          onTogglePicker={() => setPickerOpen((v) => !v)}
          onReply={onReply}
          onCopy={comment.body ? () => copyText(comment.body) : undefined}
          onEdit={
            canEditComment(comment, meId)
              ? () => {
                  setDraft(comment.body)
                  setEditing(true)
                }
              : undefined
          }
          onDelete={canDeleteComment(comment, meId, isTech) ? () => void remove() : undefined}
          deleteTitle={
            comment.author_id === meId ? 'Excluir comentário' : 'Excluir comentário (time tech)'
          }
        />
      )}
      {pickerOpen && (
        <EmotePickerPopover
          onSelect={(emoji) => void react(emoji)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </li>
  )
}

/** Conversa do card: lista (ao vivo pelo tempo real) e caixa para comentar, como o chat do servidor. */
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
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Se o comentário respondido sumiu (apagado por alguém), a resposta é cancelada.
  const replyingTo = comments.find((c) => c.id === replyToId) ?? null

  useEffect(() => {
    loadComments(proposalId).catch(() => setFailedFor(proposalId))
  }, [proposalId, loadComments])

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
    },
    []
  )

  const jumpTo = (commentId: string): void => {
    const el = document.getElementById(`comment-${commentId}`)
    if (!el) {
      showToast.info('Esse comentário não está mais aqui.')
      return
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setHighlightId(commentId)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
  }

  return (
    <section aria-label="Comentários" className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-strong">
        Comentários{loaded && comments.length > 0 ? ` (${comments.length})` : ''}
      </h3>
      {!loaded ? (
        failed ? (
          <p className="text-xs text-gray-400">Não foi possível carregar os comentários.</p>
        ) : (
          <CommentListSkeleton />
        )
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-500">Ninguém comentou ainda. Comece a conversa!</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              proposalId={proposalId}
              meId={meId}
              isTech={isTech}
              highlighted={highlightId === c.id}
              onReply={() => setReplyToId(c.id)}
              onJump={jumpTo}
            />
          ))}
        </ul>
      )}
      <CommentComposer
        proposalId={proposalId}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyToId(null)}
      />
    </section>
  )
}

export default ProposalComments
