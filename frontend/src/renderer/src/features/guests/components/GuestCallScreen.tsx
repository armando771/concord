import { useState } from 'react'
import CallStage from '../../call/components/CallStage'
import ScreenSharePrompt from '../../call/components/ScreenSharePrompt'
import useSpeaking from '../../call/hooks/useSpeaking'
import { useSessionConnection } from '../../auth/hooks/useSessionConnection'
import { InviteSpinner } from '../../servers/components/InviteServerInfo'
import Button from '../../../shared/ui/Button'
import Modal from '../../../shared/ui/Modal'
import { GUEST_COPY } from '../lib/guestCopy'
import { leaveGuestSession, useGuestCall } from '../hooks/useGuestCall'
import type { GuestPass } from '../api/guestInvites'
import type { GuestCallPhase } from '../lib/guestCallPhase'
import GuestCallHeader from './GuestCallHeader'
import GuestCallControls from './GuestCallControls'
import GuestVolumePanel from './GuestVolumePanel'

function ConnectedStage(): React.JSX.Element {
  return <CallStage speaking={useSpeaking()} />
}

function LeftCall({ onRejoin }: { onRejoin: () => void }): React.JSX.Element {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <h2 className="text-ds-lg font-bold text-strong">{GUEST_COPY.leftTitle}</h2>
      <p className="mt-2 text-ds-sm text-gray-300">{GUEST_COPY.leftBody}</p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button className="min-h-10" onClick={onRejoin}>
          {GUEST_COPY.rejoin}
        </Button>
        <Button variant="ghost" className="min-h-10" onClick={leaveGuestSession}>
          {GUEST_COPY.exit}
        </Button>
      </div>
    </div>
  )
}

/** "Sair da call?" do X: sair encerra o acesso neste navegador. */
export function LeaveConfirm({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  return (
    <Modal open={open} title={GUEST_COPY.leaveTitle} onClose={onClose}>
      <p className="text-ds-sm text-gray-300">{GUEST_COPY.leaveBody}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" className="min-h-10" onClick={onClose}>
          {GUEST_COPY.stay}
        </Button>
        <Button variant="danger" className="min-h-10" onClick={leaveGuestSession}>
          {GUEST_COPY.leaveConfirm}
        </Button>
      </div>
    </Modal>
  )
}

const BODY: Record<GuestCallPhase, (rejoin: () => void) => React.JSX.Element> = {
  active: () => <ConnectedStage />,
  left: (rejoin) => <LeftCall onRejoin={rejoin} />,
  connecting: () => (
    <div role="status" aria-label={GUEST_COPY.joining}>
      <InviteSpinner />
    </div>
  )
}

/**
 * A tela do visitante sem conta: só a call do convite (sem lista de canais,
 * chats nem membros fora da call). Mesmo palco da call de quem é membro, com
 * controles próprios. O X pergunta antes de sair; fora da call, "Sair" vai
 * direto para a tela final.
 */
function GuestCallScreen({ pass }: { pass: GuestPass }): React.JSX.Element {
  useSessionConnection(true)
  const { phase, rejoin } = useGuestCall(pass)
  const [volumes, setVolumes] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const close = phase === 'left' ? leaveGuestSession : () => setLeaving(true)

  return (
    <div className="fixed inset-0 flex flex-col bg-tertiary">
      <GuestCallHeader pass={pass} onClose={close} />
      <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-y-auto p-3 sm:p-6">
        {BODY[phase](rejoin)}
      </main>
      {phase === 'active' && <GuestCallControls onVolumes={() => setVolumes(true)} />}
      <GuestVolumePanel open={volumes} onClose={() => setVolumes(false)} />
      <LeaveConfirm open={leaving} onClose={() => setLeaving(false)} />
      <ScreenSharePrompt />
    </div>
  )
}

export default GuestCallScreen
