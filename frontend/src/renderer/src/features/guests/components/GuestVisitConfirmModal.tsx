import Modal from '../../../shared/ui/Modal'
import Button from '../../../shared/ui/Button'
import { InviteServerIcon, InviteSpinner } from '../../servers/components/InviteServerInfo'
import { GUEST_COPY } from '../lib/guestCopy'
import { useGuestPreview, type GuestPreviewState } from '../hooks/useGuestPreview'
import { useGuestVisitJoin } from '../hooks/useGuestVisitJoin'
import { useGuestLinkStore } from '../store/guestLinkStore'
import type { GuestPreview } from '../api/guestInvites'

/**
 * Quem tem conta abriu um link de visitante (no app ou no navegador): confirma
 * e entra na call sem sair do app. Esc, o X e "Agora não" fecham.
 */
function GuestVisitConfirmModal(): React.JSX.Element | null {
  const token = useGuestLinkStore((s) => s.token)
  if (!token) return null
  // key: outro link zera o estado (prévia, erro, entrando).
  return <VisitConfirm key={token} token={token} />
}

function modalTitle(state: GuestPreviewState): string | undefined {
  if (state.status === 'ready') {
    return GUEST_COPY.confirmTitle(state.preview.channel_name, state.preview.server_name)
  }
  return state.status === 'error' ? GUEST_COPY.unavailableTitle : undefined
}

type Body = (token: string, state: GuestPreviewState, close: () => void) => React.JSX.Element

const BODY: Record<GuestPreviewState['status'], Body> = {
  loading: () => (
    <div role="status" className="flex justify-center py-6">
      <InviteSpinner />
    </div>
  ),
  error: (_token, state, close) => (
    <>
      <p className="text-ds-sm text-gray-300">{state.status === 'error' && state.message}</p>
      <Button variant="secondary" className="mt-6 min-h-10 w-full" onClick={close}>
        {GUEST_COPY.close}
      </Button>
    </>
  ),
  ready: (token, state, close) =>
    state.status === 'ready' ? (
      <ConfirmBody token={token} preview={state.preview} onCancel={close} />
    ) : (
      <></>
    )
}

function VisitConfirm({ token }: { token: string }): React.JSX.Element {
  const close = useGuestLinkStore((s) => s.close)
  const state = useGuestPreview(token)
  return (
    <Modal open title={modalTitle(state)} onClose={close}>
      {BODY[state.status](token, state, close)}
    </Modal>
  )
}

export function ConfirmBody({
  token,
  preview,
  onCancel
}: {
  token: string
  preview: GuestPreview
  onCancel: () => void
}): React.JSX.Element {
  const visit = useGuestVisitJoin(token)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <InviteServerIcon name={preview.server_name} size={48} />
        <p className="min-w-0 text-ds-sm text-gray-300">{GUEST_COPY.confirmBody(preview.inviter_name)}</p>
      </div>
      <p className="text-ds-sm text-gray-300">
        {GUEST_COPY.landingPerms(preview.can_speak, preview.can_stream)}
      </p>
      {visit.error && (
        <p role="alert" className="text-ds-sm text-red-300">
          {visit.error}
        </p>
      )}
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" className="min-h-10" onClick={onCancel} disabled={visit.joining}>
          {GUEST_COPY.notNow}
        </Button>
        <Button className="min-h-10" onClick={() => void visit.join()} disabled={visit.joining}>
          {visit.joining ? GUEST_COPY.joining : GUEST_COPY.join}
        </Button>
      </div>
    </div>
  )
}

export default GuestVisitConfirmModal
