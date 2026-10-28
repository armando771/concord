import { HIDDEN_BADGES_HINT, hiddenBadgesTitle } from '../lib/hiddenBadges'

/**
 * "N badges ocultos restantes" (como as conquistas secretas da Steam): diz
 * quantos faltam sem dizer quais nem o que precisa. Não mostra nada com 0.
 */
function HiddenBadgesNotice({
  count,
  className = ''
}: {
  count: number | undefined
  className?: string
}): React.JSX.Element | null {
  const title = hiddenBadgesTitle(count)
  if (!title) return null
  return (
    <div className={`flex items-center gap-3 rounded-xl bg-fg/5 p-3 ${className}`}>
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-fg/10 text-2xl font-black text-gray-400"
      >
        ?
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-snug text-strong">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-gray-400">{HIDDEN_BADGES_HINT}</p>
      </div>
    </div>
  )
}

export default HiddenBadgesNotice
