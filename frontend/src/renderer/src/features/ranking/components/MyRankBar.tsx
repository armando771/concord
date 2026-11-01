import { formatXp, myPositionText } from '../lib/ranking'
import type { MyRank } from '../api/ranking'
import LevelChip from './LevelChip'

/** Faixa fixa no pé da página: "Sua posição: #N", mesmo fora do top 100. */
function MyRankBar({ me }: { me: MyRank | null }): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-between gap-3 border-t border-subtle bg-secondary px-4 py-3"
    >
      <span className="min-w-0 truncate text-sm font-bold text-strong">{myPositionText(me)}</span>
      {me && (
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-gray-400 sm:inline">{formatXp(me.xp)}</span>
          <LevelChip level={me.level} />
        </span>
      )}
    </div>
  )
}

export default MyRankBar
