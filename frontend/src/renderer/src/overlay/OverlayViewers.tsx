import { overlayRowOpacity } from '../features/overlay/lib/overlayState'
import { EyeIcon } from '../shared/ui/icons'

function viewersTitle(viewers: number): string {
  if (viewers === 0) return 'Ninguém assistindo a sua live'
  return `${viewers} ${viewers === 1 ? 'pessoa assistindo' : 'pessoas assistindo'} a sua live`
}

/** Olho + número de espectadores da minha live (null = sem live: nada). */
export function OverlayViewers({
  viewers,
  opacity
}: {
  viewers: number | null
  opacity: number
}): React.JSX.Element | null {
  if (viewers === null) return null
  return (
    <div
      title={viewersTitle(viewers)}
      className="flex w-fit items-center gap-1.5 rounded-full bg-floating/85 px-3 py-1 text-sm font-medium text-gray-200"
      style={{ opacity: overlayRowOpacity(opacity, false) / 100 }}
    >
      <EyeIcon className="h-3.5 w-3.5 shrink-0 text-success" />
      <span>{viewers}</span>
    </div>
  )
}

/** Olho pequeno ao lado do nome de quem assiste a minha live. */
export function OverlayWatchingEye({ watching }: { watching: boolean }): React.JSX.Element | null {
  if (!watching) return null
  return (
    <span title="Assistindo a sua live" className="flex shrink-0 text-success">
      <EyeIcon className="h-3.5 w-3.5" />
    </span>
  )
}
