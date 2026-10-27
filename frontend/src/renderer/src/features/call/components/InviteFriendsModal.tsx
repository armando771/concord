import { useEffect } from 'react'
import Modal from '../../../shared/ui/Modal'
import Button from '../../../shared/ui/Button'
import { useFriendStore } from '../../friends/store/friendStore'
import { useCallInviteStore } from '../store/callInviteStore'
import { INVITE_COPY } from '../lib/callInviteCopy'
import InviteFriendsForm from './InviteFriendsForm'
import InviteResultsList from './InviteResultsList'

function useCloseOnEscape(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

function nameFrom(
  friends: { id: string; username: string; display_name: string }[],
  id: string
): string {
  const f = friends.find((x) => x.id === id)
  return f ? f.display_name || f.username : id
}

/** Janela "Convidar amigos": o formulário de escolha e, depois, o resultado. */
function InviteFriendsModal({
  open,
  callId,
  onClose
}: {
  open: boolean
  callId: string
  onClose: () => void
}): React.JSX.Element | null {
  const friends = useFriendStore((s) => s.friends)
  const phase = useCallInviteStore((s) => s.phase)
  const results = useCallInviteStore((s) => s.results)

  useCloseOnEscape(open, onClose)
  useEffect(() => {
    if (!open) return
    if (!useFriendStore.getState().loaded) void useFriendStore.getState().loadAll()
    useCallInviteStore.getState().resetSend()
  }, [open])

  return (
    <Modal open={open} title={INVITE_COPY.modalTitle} onClose={onClose}>
      {phase === 'ok' ? (
        <>
          <InviteResultsList results={results} nameOf={(id) => nameFrom(friends, id)} />
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" className="min-h-10" onClick={onClose}>
              {INVITE_COPY.close}
            </Button>
            <Button className="min-h-10" onClick={() => useCallInviteStore.getState().resetSend()}>
              {INVITE_COPY.inviteMore}
            </Button>
          </div>
        </>
      ) : (
        <InviteFriendsForm callId={callId} />
      )}
    </Modal>
  )
}

export default InviteFriendsModal
