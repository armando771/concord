import { copyText } from '../../../shared/lib/clipboard'
import MessageActionsBar from '../../chat/components/MessageActionsBar'
import type { ProposalComment } from '../api/proposals'
import { canDeleteComment, canEditComment } from '../lib/proposals'

/** Barra de ações de um comentário (reagir, responder, copiar, editar, apagar). */
function CommentActions({
  comment,
  meId,
  isTech,
  onReact,
  onTogglePicker,
  onReply,
  onEdit,
  onDelete
}: {
  comment: ProposalComment
  meId: string | null
  isTech: boolean
  onReact: (emoji: string) => void
  onTogglePicker: () => void
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <MessageActionsBar
      canReact
      onReact={onReact}
      onTogglePicker={onTogglePicker}
      onReply={onReply}
      onCopy={comment.body ? () => copyText(comment.body) : undefined}
      onEdit={canEditComment(comment, meId) ? onEdit : undefined}
      onDelete={canDeleteComment(comment, meId, isTech) ? onDelete : undefined}
      deleteTitle={
        comment.author_id === meId ? 'Excluir comentário' : 'Excluir comentário (time tech)'
      }
    />
  )
}

export default CommentActions
