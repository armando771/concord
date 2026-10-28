import Avatar from '../../../shared/ui/Avatar'
import StyledName from '../../profile/components/StyledName'
import { profileCardHandler } from '../../profile/store/profileCardStore'
import type { RankingEntry } from '../api/ranking'
import { formatXp, positionLabel } from '../lib/ranking'
import LevelChip from './LevelChip'

/** Uma linha do ranking (4º em diante); clicar abre o cartão de perfil. */
function RankRow({ entry, isMe }: { entry: RankingEntry; isMe: boolean }): React.JSX.Element {
  const name = entry.display_name || entry.username
  return (
    <li>
      <button
        type="button"
        onClick={profileCardHandler(entry.user_id, name, entry.username, 'top')}
        className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-violet-400 ${isMe ? 'bg-violet-500/10' : ''}`}
      >
        <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums text-gray-400">
          {positionLabel(entry.position)}
        </span>
        <Avatar userId={entry.user_id} name={name} avatarUrl={entry.avatar_url} size={36} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-strong">
          <StyledName name={name} userId={entry.user_id} style={entry.name_style} />
        </span>
        <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">
          {formatXp(entry.xp)}
        </span>
        <LevelChip level={entry.level} />
      </button>
    </li>
  )
}

export default RankRow
