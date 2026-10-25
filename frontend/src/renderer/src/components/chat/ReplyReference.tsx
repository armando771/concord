/**
 * Linha "↳ @fulano texto…" acima de uma mensagem que responde a outra. Clicar
 * leva até a original; se ela foi excluída, mostra o aviso.
 */
function ReplyReference({
  authorName,
  content,
  emptyLabel = '📊 Enquete / Anexo',
  onJump
}: {
  /** Nulo quando a mensagem original foi excluída. */
  authorName: string | null
  content: string
  /** O que mostrar quando a original não tem texto (só anexo ou enquete). */
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
          <span className="shrink-0 font-semibold text-gray-300">@{authorName}</span>
          <span className="truncate text-gray-400">{content || emptyLabel}</span>
        </button>
      ) : (
        <span className="italic text-gray-500">Mensagem original foi excluída</span>
      )}
    </div>
  )
}

export default ReplyReference
