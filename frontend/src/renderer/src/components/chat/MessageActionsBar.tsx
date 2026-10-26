import { QUICK_EMOTES } from '../../lib/emotes'

const textButton =
  'flex h-6 cursor-pointer items-center justify-center rounded px-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white'

/**
 * Barra que aparece sobre a mensagem ao passar o mouse: reações rápidas,
 * seletor de emoji, responder, copiar, editar, fixar e excluir. Cada ação só aparece
 * quando o handler vem (copiar sem texto, editar de outro autor etc. ficam de fora).
 */
function MessageActionsBar({
  canReact,
  onReact,
  onTogglePicker,
  onReply,
  onCopy,
  onEdit,
  canPin,
  isPinned,
  onTogglePin,
  onDelete,
  deleteTitle = 'Excluir mensagem'
}: {
  canReact: boolean
  onReact: (emoji: string) => void
  onTogglePicker: () => void
  onReply: () => void
  onCopy?: () => void
  onEdit?: () => void
  canPin?: boolean
  isPinned?: boolean
  onTogglePin?: () => void
  onDelete?: () => void
  deleteTitle?: string
}): React.JSX.Element {
  return (
    <div className="absolute -top-3 right-4 z-20 flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#18191c] px-1 py-0.5 shadow-lg">
      {canReact &&
        QUICK_EMOTES.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            title={`Reagir com ${emoji}`}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-sm transition-transform hover:scale-110 hover:bg-white/10"
          >
            {emoji}
          </button>
        ))}
      {canReact && (
        <button
          type="button"
          onClick={onTogglePicker}
          title="Mais reações"
          className="flex h-6 cursor-pointer items-center justify-center rounded px-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          😀+
        </button>
      )}
      <button type="button" onClick={onReply} title="Responder" className={textButton}>
        Responder
      </button>
      {canPin && onTogglePin && (
        <button
          type="button"
          onClick={onTogglePin}
          title={isPinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
          className={textButton}
        >
          {isPinned ? 'Desafixar' : 'Fixar'}
        </button>
      )}
      {onCopy && (
        <button type="button" onClick={onCopy} title="Copiar texto" className={textButton}>
          Copiar texto
        </button>
      )}
      {onEdit && (
        <button type="button" onClick={onEdit} title="Editar mensagem" className={textButton}>
          Editar
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title={deleteTitle}
          className="flex h-6 cursor-pointer items-center justify-center rounded px-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
        >
          Excluir
        </button>
      )}
    </div>
  )
}

export default MessageActionsBar
