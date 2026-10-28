import type { Badge } from '../api/badges'
import type { BadgesModalTarget } from '../store/badgeStore'
import Avatar from '../../../shared/ui/Avatar'
import { BadgeGridSkeleton } from '../../../shared/ui/skeleton/layouts'
import BadgeGrid from './BadgeGrid'
import HiddenBadgesNotice from './HiddenBadgesNotice'

interface BadgesAsideProps {
  target: BadgesModalTarget
  isMe: boolean
  titleId: string
  /** undefined enquanto carrega. */
  badges: Badge[] | undefined
  earned: Badge[]
  /** Quantos ainda faltam (sem dizer quais); 0 ou undefined não mostra. */
  hiddenRemaining?: number
  selected: Badge | undefined
  onSelect: (category: string) => void
  /** Há uma conta logada: mostra "Ver seus badges" no perfil dos outros. */
  canViewMine: boolean
  onViewMine: () => void
}

/** Coluna da grade: quem é e o que já ganhou; o que falta é só um número. */
function BadgesAside({
  target,
  isMe,
  titleId,
  badges,
  earned,
  hiddenRemaining,
  selected,
  onSelect,
  canViewMine,
  onViewMine
}: BadgesAsideProps): React.JSX.Element {
  return (
    <aside className="flex max-h-[50%] w-full shrink-0 flex-col bg-secondary md:max-h-none md:w-[290px]">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-2.5">
          {!isMe && (
            <Avatar
              userId={target.userId}
              name={target.name}
              avatarUrl={target.avatarUrl}
              size={28}
            />
          )}
          <h2 id={titleId} className="min-w-0 truncate text-xl font-bold text-strong">
            {isMe ? 'Seus badges' : `Badges de ${target.name}`}
          </h2>
        </div>
        <p className="mt-1.5 text-sm leading-snug text-gray-400">
          {isMe
            ? 'Os badges aparecem conforme você usa o Salinha.'
            : `Explore os badges de ${target.name} ou veja os seus.`}
        </p>

        {!badges ? (
          <BadgeGridSkeleton />
        ) : earned.length > 0 ? (
          <div className="mt-5">
            <BadgeGrid badges={earned} selected={selected?.category} onSelect={onSelect} />
          </div>
        ) : (
          <p className="mt-5 text-sm text-gray-500">
            {isMe
              ? 'Nenhum badge ainda. Eles aparecem conforme você usa o Salinha.'
              : 'Nenhum badge ainda.'}
          </p>
        )}
        {badges && <HiddenBadgesNotice count={hiddenRemaining} className="mt-4" />}
      </div>
      {!isMe && canViewMine && (
        <div className="border-t border-subtle p-4">
          <button
            type="button"
            onClick={onViewMine}
            className="w-full cursor-pointer rounded-lg bg-fg/10 px-3 py-2 text-sm font-semibold text-strong transition-colors hover:bg-fg/15"
          >
            Ver seus badges
          </button>
        </div>
      )}
    </aside>
  )
}

export default BadgesAside
