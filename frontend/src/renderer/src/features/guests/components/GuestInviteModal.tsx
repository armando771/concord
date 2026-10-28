import Modal from '../../../shared/ui/Modal'
import { GUEST_COPY } from '../lib/guestCopy'
import { useGuestInvites } from '../hooks/useGuestInvites'
import GuestInviteForm from './GuestInviteForm'
import GuestLinkReady from './GuestLinkReady'
import GuestInviteList from './GuestInviteList'

/** "Convidar visitante": gerar o link, copiar e gerenciar os ativos. */
function GuestInviteModal({
  open,
  channelId,
  onClose
}: {
  open: boolean
  channelId: string
  onClose: () => void
}): React.JSX.Element {
  const state = useGuestInvites(channelId, open)
  return (
    <Modal open={open} title={GUEST_COPY.modalTitle} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-ds-sm text-gray-300">{GUEST_COPY.modalIntro}</p>
        {state.link ? (
          <GuestLinkReady link={state.link} onNew={state.clearLink} />
        ) : (
          <GuestInviteForm state={state} />
        )}
        <GuestInviteList state={state} />
      </div>
    </Modal>
  )
}

export default GuestInviteModal
