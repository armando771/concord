import { useState } from 'react'
import { UserPlusIcon } from '../../../shared/ui/icons'
import { GUEST_COPY } from '../lib/guestCopy'
import GuestInviteModal from './GuestInviteModal'

/**
 * "Convidar visitante" no topo da call do canal de voz (só para quem tem a
 * permissão; quem chama decide). No celular fica só o ícone.
 */
function GuestInviteButton({ channelId }: { channelId: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={GUEST_COPY.button}
        title={GUEST_COPY.button}
        className="flex h-10 min-w-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-subtle bg-secondary px-3 text-ds-sm font-semibold text-gray-200 shadow-lg transition-colors hover:bg-fg/10 hover:text-strong focus-visible:ring-2 focus-visible:ring-brand"
      >
        <UserPlusIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{GUEST_COPY.button}</span>
      </button>
      <GuestInviteModal open={open} channelId={channelId} onClose={() => setOpen(false)} />
    </>
  )
}

export default GuestInviteButton
