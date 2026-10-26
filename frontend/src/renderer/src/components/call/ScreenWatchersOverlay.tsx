import type { CallUserInfo } from '../../store/callStore'
import Avatar from '../Avatar'
import { EyeIcon } from '../icons'

interface ScreenWatchersOverlayProps {
  watchers: CallUserInfo[]
  className?: string
}

export default function ScreenWatchersOverlay({
  watchers,
  className = ''
}: ScreenWatchersOverlayProps): React.JSX.Element | null {
  if (!watchers || watchers.length === 0) return null

  const maxVisible = 4
  const visibleWatchers = watchers.slice(0, maxVisible)
  const remainingCount = watchers.length - visibleWatchers.length

  const tooltipText = watchers.map((w) => w.display_name || w.username).join(', ')

  return (
    <div
      data-testid="screen-watchers-overlay"
      title={`Assistindo (${watchers.length}): ${tooltipText}`}
      className={`on-media z-20 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-1 text-xs text-white backdrop-blur-md shadow-lg border border-white/10 select-none ${className}`}
    >
      <div className="flex items-center gap-1 text-gray-300">
        <EyeIcon className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[11px] font-bold text-gray-200">{watchers.length}</span>
      </div>

      <div className="flex items-center -space-x-1.5 ml-0.5">
        {visibleWatchers.map((watcher) => (
          <div
            key={watcher.id}
            title={watcher.display_name || watcher.username}
            className="relative transition-transform hover:z-30 hover:scale-110"
          >
            <Avatar
              userId={watcher.id}
              name={watcher.display_name || watcher.username}
              avatarUrl={watcher.avatar_url}
              size={20}
              className="rounded-full ring-2 ring-black/80"
            />
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            title={`+${remainingCount} outros: ${watchers
              .slice(maxVisible)
              .map((w) => w.display_name || w.username)
              .join(', ')}`}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-fg/20 text-[10px] font-bold text-strong ring-2 ring-black/80"
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  )
}
