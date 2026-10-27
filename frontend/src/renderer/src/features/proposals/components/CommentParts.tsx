import type { ProposalComment } from '../api/proposals'
import MessageAttachments from '../../chat/components/MessageAttachments'
import MessageText from '../../chat/components/MessageText'
import ReplyReference from '../../chat/components/ReplyReference'
import { commentPreview } from '../lib/proposals'
import CommentEditForm from './CommentEditForm'

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** A resposta citada em cima do comentário (some se o comentário não é resposta). */
export function CommentReply({
  comment,
  onJump
}: {
  comment: ProposalComment
  onJump: (commentId: string) => void
}): React.JSX.Element | null {
  if (!comment.reply_to_id && !comment.reply_to) return null
  const original = comment.reply_to
  return (
    <ReplyReference
      authorName={original ? original.author_name : null}
      content={original ? commentPreview(original) : ''}
      emptyLabel="📎 Anexo"
      onJump={() => original && onJump(original.id)}
    />
  )
}

/** Autor, hora e o "(editado)". */
export function CommentMeta({ comment }: { comment: ProposalComment }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
      <span className="font-semibold text-strong">{comment.author_name}</span>
      <span className="text-gray-500">{formatTime(comment.created_at)}</span>
      {comment.edited_at && <span className="text-gray-500">(editado)</span>}
    </div>
  )
}

/** O texto do comentário (ou o campo de edição) e os anexos. */
export function CommentBody({
  comment,
  editing,
  editForm
}: {
  comment: ProposalComment
  editing: boolean
  /** O formulário de edição, já ligado ao estado do comentário. */
  editForm: React.ReactElement<React.ComponentProps<typeof CommentEditForm>>
}): React.JSX.Element {
  return (
    <>
      {editing ? editForm : comment.body && <MessageText content={comment.body} everyone={null} />}
      {comment.attachments.length > 0 && <MessageAttachments attachments={comment.attachments} />}
    </>
  )
}
