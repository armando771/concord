import { gameAccent } from '../../../shared/gameCatalog'
import { activityElapsed, type PresenceActivity } from '../lib/presenceActivity'
import Avatar from './Avatar'
import { GamepadIcon } from './icons'

/** Card da coluna "Atividade": amigo, jogo em destaque e há quanto tempo. */
export function ActivityCard({
  user,
  activity,
  onClick
}: {
  user: { id: string; username: string; display_name?: string; avatar_url?: string | null }
  activity: PresenceActivity
  onClick?: () => void
}): React.JSX.Element {
  const accent = gameAccent(activity.name) ?? '#5865f2'
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-white/6 bg-[#111214] p-3 text-left transition-colors hover:bg-white/5"
    >
      <Avatar
        userId={user.id}
        name={user.display_name || user.username}
        avatarUrl={user.avatar_url}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-ds-sm font-medium text-gray-400">
          {user.display_name || user.username}
        </p>
        <p className="truncate text-ds-md font-bold text-white">{activity.name}</p>
        <p className="truncate text-ds-xs text-gray-400">
          {activityElapsed(activity.started_at, Date.now())}
        </p>
      </div>
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
        style={{ background: `${accent}33`, color: accent }}
      >
        <GamepadIcon className="h-6 w-6" />
      </span>
    </button>
  )
}
