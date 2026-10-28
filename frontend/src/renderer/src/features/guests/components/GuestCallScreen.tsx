import { useEffect, useState } from 'react'
import CallStage from '../../call/components/CallStage'
import ScreenSharePrompt from '../../call/components/ScreenSharePrompt'
import useSpeaking from '../../call/hooks/useSpeaking'
import { useSessionConnection } from '../../auth/hooks/useSessionConnection'
import { InviteSpinner } from '../../servers/components/InviteServerInfo'
import Button from '../../../shared/ui/Button'
import { GUEST_COPY } from '../lib/guestCopy'
import { timeLeftLabel } from '../lib/guestTime'
import { useGuestCall } from '../hooks/useGuestCall'
import type { GuestPass } from '../api/guestInvites'
import type { GuestCallPhase } from '../lib/guestCallPhase'
import GuestBadge from './GuestBadge'
import GuestCallControls from './GuestCallControls'
import GuestVolumePanel from './GuestVolumePanel'

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

function GuestHeader({ pass }: { pass: GuestPass }): React.JSX.Element {
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
    </header>
  )
}

function ConnectedStage(): React.JSX.Element {
  return <CallStage speaking={useSpeaking()} />
}

function LeftCall({ onRejoin }: { onRejoin: () => void }): React.JSX.Element {
  return (
    <div className="flex max-w-sm flex-col items-center text-center">
      <h2 className="text-ds-lg font-bold text-strong">{GUEST_COPY.leftTitle}</h2>
      <p className="mt-2 text-ds-sm text-gray-300">{GUEST_COPY.leftBody}</p>
      <Button className="mt-6 min-h-10" onClick={onRejoin}>
        {GUEST_COPY.rejoin}
      </Button>
    </div>
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
 * A tela do visitante: só a call do convite (sem lista de canais, chats nem
 * membros fora da call). Mesmo palco da call de quem é membro, com controles
 * próprios.
 */
function GuestCallScreen({ pass }: { pass: GuestPass }): React.JSX.Element {
  useSessionConnection(true)
  const { phase, rejoin } = useGuestCall(pass)
  const [volumes, setVolumes] = useState(false)

  return (
    <div className="fixed inset-0 flex flex-col bg-tertiary">
      <GuestHeader pass={pass} />
      <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-y-auto p-3 sm:p-6">
        {BODY[phase](rejoin)}
      </main>
      {phase === 'active' && <GuestCallControls onVolumes={() => setVolumes(true)} />}
      <GuestVolumePanel open={volumes} onClose={() => setVolumes(false)} />
      <ScreenSharePrompt />
    </div>
  )
}

export default GuestCallScreen
