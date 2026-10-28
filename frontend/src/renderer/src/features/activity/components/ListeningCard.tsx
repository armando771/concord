import { musicAccent } from '../../../../../shared/musicApps'
import { listeningSummary, type ListeningActivity } from '../lib/listeningActivity'
import type { NameStyle } from '../../profile/lib/nameStyle'
import { useUserLook } from '../../profile/store/profileStore'
import Avatar from '../../../shared/ui/Avatar'
import StyledName from '../../profile/components/StyledName'
import MusicIcon from './MusicIcon'

/** Card da coluna "Atividade" para quem está ouvindo música: amigo, faixa e o player. */
export function ListeningCard({
  user,
  listening,
  onClick
}: {
  user: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string | null
    name_style?: NameStyle
  }
  listening: ListeningActivity
  onClick?: () => void
}): React.JSX.Element {
  const accent = musicAccent(listening.app) ?? '#5865f2'
  const look = useUserLook(user.id, {
    name: user.display_name || user.username,
    avatarUrl: user.avatar_url
  })
  return (
    <button
      type="button"
      onClick={onClick}
      title={listeningSummary(listening)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-subtle bg-floating p-3 text-left transition-colors hover:bg-fg/5"
    >
      <Avatar userId={user.id} name={look.name} avatarUrl={look.avatarUrl} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-ds-sm font-medium text-gray-400">
          <StyledName name={look.name} userId={user.id} style={user.name_style} />
        </p>
        <p className="truncate text-ds-md font-bold text-strong">{listening.title}</p>
        <p className="truncate text-ds-xs text-gray-400">
          {listening.artist ? `${listening.artist} · ` : ''}
          {listening.app}
        </p>
      </div>
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
        style={{ background: `${accent}33` }}
      >
        <MusicIcon app={listening.app} className="h-6 w-6" />
      </span>
    </button>
  )
}
