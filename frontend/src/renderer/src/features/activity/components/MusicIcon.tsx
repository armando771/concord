import { musicAccent } from '../../../../../shared/musicApps'
import { musicIconPath } from '../lib/musicIcons'

/** Nota musical (player sem logo conhecido). */
function NoteIcon({ className }: { className: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
    </svg>
  )
}

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
        <NoteIcon className={className} />
      )}
    </span>
  )
}

export default MusicIcon
