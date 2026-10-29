import { Link } from 'react-router-dom'
import { ChevronRightIcon } from '../../../shared/ui/icons'

/** Card grande da tela inicial da aba do diamante: leva à tela do assunto. */
function HubCard({
  to,
  icon,
  title,
  description,
  stat,
  tone
}: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  /** Dado ao vivo (ex.: "3 em votação"); sem ele, a linha não aparece. */
  stat: string | null
  /** Classes do degradê e do ícone (cada card tem a sua cor). */
  tone: { glow: string; icon: string }
}): React.JSX.Element {
  return (
    <Link
      to={to}
      className="group relative flex min-h-44 flex-col gap-3 overflow-hidden rounded-2xl border border-subtle bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-normal hover:shadow-lg focus-visible:outline-2 focus-visible:outline-violet-400"
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-50 ${tone.glow}`}
      />
      <div
        className={`relative flex size-12 items-center justify-center rounded-xl bg-fg/5 ${tone.icon}`}
      >
        {icon}
      </div>
      <div className="relative min-w-0 flex-1">
        <h2 className="text-lg font-bold text-strong">{title}</h2>
        <p className="mt-1 text-sm text-gray-400">{description}</p>
      </div>
      <div className="relative flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-semibold text-gray-300">{stat ?? ' '}</span>
        <ChevronRightIcon className="size-5 shrink-0 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-strong" />
      </div>
    </Link>
  )
}

export default HubCard
