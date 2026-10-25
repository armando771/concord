export interface ReactionSummary {
  emoji: string
  count: number
  user_ids: string[]
}

/** Chips de reação sob a mensagem, com o "+" para abrir o seletor de emoji. */
function ReactionChips({
  reactions,
  meId,
  canReact,
  onReact,
  onOpenPicker
}: {
  reactions: ReactionSummary[]
  meId: string | undefined
  /** Sem permissão ainda dá para tirar a própria reação. */
  canReact: boolean
  onReact: (emoji: string) => void
  onOpenPicker: () => void
}): React.JSX.Element | null {
  if (reactions.length === 0) return null

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => {
        const meReacted = meId ? reaction.user_ids.includes(meId) : false
        return (
          <button
            key={reaction.emoji}
            type="button"
            onClick={() => onReact(reaction.emoji)}
            disabled={!canReact && !meReacted}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              meReacted
                ? 'border-[#5865f2] bg-[#5865f2]/25 text-white'
                : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <span>{reaction.emoji}</span>
            <span className="font-semibold">{reaction.count}</span>
          </button>
        )
      })}
      {canReact && (
        <button
          type="button"
          onClick={onOpenPicker}
          title="Adicionar reação"
          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          +
        </button>
      )}
    </div>
  )
}

export default ReactionChips
