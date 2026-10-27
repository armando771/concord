import { useState } from 'react'
import { UserPlusIcon } from '../../../shared/ui/icons'
import { useCallStore } from '../store/callStore'
import { INVITE_COPY } from '../lib/callInviteCopy'
import InviteFriendsModal from './InviteFriendsModal'

/**
 * "Convidar amigos" da chamada de canal de voz. Não aparece em chamada de DM
 * (1:1, não comporta terceiros).
 */
function InviteFriendsButton(): React.JSX.Element | null {
  const callId = useCallStore((s) => s.callId)
  const isChannelCall = useCallStore((s) => s.type === 'channel' && s.status === 'active')
  const [open, setOpen] = useState(false)

  if (!isChannelCall || !callId) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={INVITE_COPY.buttonLabel}
        aria-haspopup="dialog"
        title={INVITE_COPY.buttonLabel}
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-subtle bg-secondary text-gray-200 shadow-lg transition-colors hover:bg-fg/10 hover:text-strong focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <UserPlusIcon className="h-5 w-5" />
      </button>
      <InviteFriendsModal open={open} callId={callId} onClose={() => setOpen(false)} />
    </>
  )
}

export default InviteFriendsButton
