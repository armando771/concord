import { musicAccent } from '../../../../../shared/musicApps'
import { MusicNoteIcon } from '../../../shared/ui/icons'
import { musicIconPath } from '../lib/musicIcons'

/** Logo do player na cor dele; sem logo, a nota musical (na cor do player, se houver). */
function MusicIcon({
  app,
  className = 'h-4 w-4'
}: {
  app: string
  className?: string
}): React.JSX.Element {
  const path = musicIconPath(app)
  const color = musicAccent(app)
  return (
    <span className="flex shrink-0 items-center" style={color ? { color } : undefined}>
      {path ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d={path} />
        </svg>
      ) : (
        <MusicNoteIcon className={className} />
      )}
    </span>
  )
}

export default MusicIcon
