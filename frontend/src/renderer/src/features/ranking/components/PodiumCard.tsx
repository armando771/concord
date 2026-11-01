import Avatar from '../../../shared/ui/Avatar'
import StyledName from '../../profile/components/StyledName'
import { profileCardHandler } from '../../profile/store/profileCardStore'
import { formatXp, positionLabel, type PodiumSlot } from '../lib/ranking'
import LevelChip from './LevelChip'

// Por colocação: tamanho do avatar, altura do degrau e cor do destaque.
const PLACE = {
  1: { avatar: 72, step: 'h-24', ring: 'ring-amber-300', text: 'text-amber-300' },
  2: { avatar: 56, step: 'h-16', ring: 'ring-slate-300', text: 'text-slate-300' },
  3: { avatar: 56, step: 'h-12', ring: 'ring-orange-400', text: 'text-orange-400' }
} as const

function PodiumCard({ slot }: { slot: PodiumSlot }): React.JSX.Element {
  const { entry, place } = slot
  const look = PLACE[place]
  const name = entry.display_name || entry.username
  return (
    <li className="flex min-w-0 flex-1 flex-col items-center justify-end">
      <button
        type="button"
        onClick={profileCardHandler(entry.user_id, name, entry.username, 'top')}
        className="flex w-full min-w-0 cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <span className={`rounded-full ring-2 ring-offset-2 ring-offset-transparent ${look.ring}`}>
          <Avatar
            userId={entry.user_id}
            name={name}
            avatarUrl={entry.avatar_url}
            size={look.avatar}
          />
        </span>
        <span className="w-full min-w-0 truncate text-center text-sm font-semibold text-strong">
          <StyledName name={name} userId={entry.user_id} style={entry.name_style} />
        </span>
        <LevelChip level={entry.level} />
        <span className="text-xs text-gray-400">{formatXp(entry.xp)}</span>
      </button>
      <div
        className={`flex w-full items-center justify-center rounded-t-lg bg-fg/5 text-2xl font-black ${look.step} ${look.text}`}
        aria-label={`${place}º lugar`}
      >
        {positionLabel(place)}
      </div>
    </li>
  )
}

export default PodiumCard
