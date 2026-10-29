import Avatar from '../../../shared/ui/Avatar'

/**
 * Linha "↳ [avatar] @fulano texto…" acima de uma mensagem que responde a outra. Clicar
 * leva até a original; se ela foi excluída, mostra o aviso.
 */
function ReplyReference({
  authorName,
  authorAvatarUrl,
  authorId,
  authorColor,
  content,
  emptyLabel = '🖼️ Imagem',
  onJump
}: {
  /** Nulo quando a mensagem original foi excluída. */
  authorName: string | null
  authorAvatarUrl?: string | null
  authorId?: string
  /** Cor do cargo mais alto do autor no servidor (CSS). */
  authorColor?: string
  content: string
  /** O que mostrar quando a original não tem texto (só anexo). */
  emptyLabel?: string
  onJump: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 pl-4 text-ds-sm text-gray-400">
      <span className="h-2.5 w-5 shrink-0 rounded-tl-md border-l-2 border-t-2 border-gray-600" />
      {authorName != null ? (
        <button
          type="button"
          onClick={onJump}
          className="flex min-w-0 cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-gray-200"
        >
          <Avatar
            userId={authorId}
            name={authorName}
            avatarUrl={authorAvatarUrl}
            size={16}
            className="shrink-0 rounded-full"
          />
          <span
            style={authorColor ? { color: authorColor } : undefined}
            className={`shrink-0 font-semibold ${authorColor ? '' : 'text-gray-300'}`}
          >
            @{authorName}
          </span>
          <span className="truncate text-gray-400">{content || emptyLabel}</span>
        </button>
      ) : (
        <span className="italic text-gray-500">Mensagem original foi excluída</span>
      )}
    </div>
  )
}

export default ReplyReference
