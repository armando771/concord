import { useNow } from '../../../shared/hooks/useNow'
import { XIcon } from '../../../shared/ui/icons'
import { GUEST_COPY } from '../lib/guestCopy'
import { timeLeftLabel } from '../lib/guestTime'
import type { GuestPass } from '../api/guestInvites'
import GuestBadge from './GuestBadge'

/**
 * O topo da call de visitante: canal, servidor, selo e quanto falta do acesso.
 * `onClose`: o X de sair (visitante sem conta, que não tem o resto do app).
 */
function GuestCallHeader({
  pass,
  onClose
}: {
  pass: GuestPass
  onClose?: () => void
}): React.JSX.Element {
  const now = useNow(30_000)
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-subtle px-4 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-ds-md font-bold text-strong">{pass.channel_name}</h1>
        <p className="truncate text-ds-xs text-gray-400">{pass.server_name}</p>
      </div>
      <GuestBadge />
      <span className="text-ds-xs text-gray-300">
        {GUEST_COPY.timeLeft(timeLeftLabel(pass.expires_at, now))}
      </span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={GUEST_COPY.closeLabel}
          title={GUEST_COPY.closeLabel}
          className="-mr-1 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong focus-visible:ring-2 focus-visible:ring-brand sm:size-8"
        >
          <XIcon className="h-5 w-5" />
        </button>
      )}
    </header>
  )
}

export default GuestCallHeader
