import { useState } from 'react'
import CallControlsDock from '../../call/components/CallControlsDock'
import CallStage from '../../call/components/CallStage'
import useSpeaking from '../../call/hooks/useSpeaking'
import { useCallStore } from '../../call/store/callStore'
import { InviteServerIcon } from '../../servers/components/InviteServerInfo'
import { isConnectedTo } from '../../servers/lib/voiceChannelRow'
import { useNow } from '../../../shared/hooks/useNow'
import Button from '../../../shared/ui/Button'
import { GUEST_COPY } from '../lib/guestCopy'
import { timeLeftLabel } from '../lib/guestTime'
import { enterVisitCall } from '../hooks/useGuestVisitJoin'
import type { GuestPass } from '../api/guestInvites'
import GuestCallHeader from './GuestCallHeader'

function ConnectedStage(): React.JSX.Element {
  return <CallStage speaking={useSpeaking()} />
}

/** Fora da call (saiu ou ainda não entrou): volta por aqui enquanto o acesso vale. */
export function VisitLobby({ visit }: { visit: GuestPass }): React.JSX.Element {
  const now = useNow(30_000)
  const [joining, setJoining] = useState(false)
  const join = (): void => {
    setJoining(true)
    void enterVisitCall(visit.channel_id).finally(() => setJoining(false))
  }
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <InviteServerIcon name={visit.server_name} iconUrl={visit.server_icon_url} size={64} />
        <h2 className="mt-4 text-ds-lg font-bold text-strong">
          {GUEST_COPY.lobbyTitle(visit.server_name)}
        </h2>
        <p className="mt-2 text-ds-sm text-gray-300">{GUEST_COPY.lobbyBody(visit.channel_name)}</p>
        <p className="mt-1 text-ds-xs text-gray-400">
          {GUEST_COPY.timeLeft(timeLeftLabel(visit.expires_at, now))}
        </p>
        <Button className="mt-6 min-h-10 w-full sm:w-auto" onClick={join} disabled={joining}>
          {joining ? GUEST_COPY.joining : GUEST_COPY.join}
        </Button>
      </div>
    </div>
  )
}

/**
 * A visita aberta no app: só a call do canal do convite, com o palco e os
 * controles de uma call comum. Dá para sair daqui (trilho, DMs) sem cair.
 */
function GuestVisitView({ visit }: { visit: GuestPass }): React.JSX.Element {
  const connected = useCallStore((s) => isConnectedTo(s, visit.channel_id))
  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
      <GuestCallHeader pass={visit} />
      {connected ? (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-3 sm:p-6">
            <ConnectedStage />
          </div>
          <CallControlsDock />
        </>
      ) : (
        <VisitLobby visit={visit} />
      )}
    </div>
  )
}

export default GuestVisitView
