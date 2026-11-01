import { Link } from 'react-router-dom'
import { SalinhaMarkIcon } from '../../../shared/ui/icons'
import { badgeText } from '../lib/serverRailBadge'

/** Selo vermelho no canto de um botão da barra; sem contagem, não aparece. */
export function RailCountBadge({ count }: { count: number }): React.JSX.Element | null {
  if (count <= 0) return null
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md">
      {badgeText(count)}
    </span>
  )
}

/** Início: botão com a marca da Salinha. */
export function RailHomeButton({
  isHome,
  unread,
  onClick
}: {
  isHome: boolean
  unread: number
  onClick: () => void
}): React.JSX.Element {
  return (
    <div className="relative flex items-center justify-center">
      <span
        className={`absolute -left-3.5 w-2 rounded-r-full bg-[var(--text-strong)] transition-all duration-200 ${
          isHome ? 'h-10' : 'h-0 group-hover/home:h-5'
        }`}
      />
      <Link
        to="/friends"
        onClick={onClick}
        aria-label="Início"
        title="Mensagens Diretas e Amigos"
        className={`group/home relative flex h-12 w-12 items-center justify-center font-bold text-xl shadow-lg transition-all duration-200 ${
          isHome
            ? 'rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-violet-500/30'
            : 'rounded-3xl bg-surface border border-subtle text-strong hover:text-white hover:rounded-2xl hover:bg-linear-to-br hover:from-violet-600 hover:to-indigo-600 hover:shadow-violet-500/30'
        }`}
      >
        <SalinhaMarkIcon className="h-8 w-8" />
      </Link>
      <RailCountBadge count={unread} />
    </div>
  )
}

/** Botão de atalho da barra (convites, propostas) com selo opcional. */
export function RailNavButton({
  label,
  active,
  badge,
  icon,
  onClick
}: {
  label: string
  active: boolean
  badge: number
  icon: (className: string) => React.ReactNode
  onClick: () => void
}): React.JSX.Element {
  return (
    <div className="relative flex items-center justify-center">
      <button
        onClick={onClick}
        title={label}
        aria-label={label}
        className={`relative flex h-12 w-12 cursor-pointer items-center justify-center transition-all duration-200 ${
          active
            ? 'rounded-2xl bg-violet-600 shadow-md shadow-violet-500/30'
            : 'rounded-3xl border border-subtle bg-surface hover:rounded-2xl hover:bg-violet-600 hover:shadow-md hover:shadow-violet-500/30'
        }`}
      >
        {icon(`h-6 w-6 ${active ? 'text-white' : 'text-violet-400'}`)}
      </button>
      <RailCountBadge count={badge} />
    </div>
  )
}
