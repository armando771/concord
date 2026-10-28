import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../shared/ui/Button'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../../call/store/callStore'
import { GUEST_COPY } from '../lib/guestCopy'
import { useGuestSessionStore } from '../store/guestSessionStore'
import GuestCard from './GuestCard'

/**
 * O acesso acabou (prazo, link revogado ou expulso): sai da call e, se era um
 * visitante sem conta, descarta a sessão de visitante.
 */
function GuestEnded({ reason }: { reason: string }): React.JSX.Element {
  const navigate = useNavigate()
  useEffect(() => {
    useCallStore.getState().endCall()
    if (useGuestSessionStore.getState().anonymous) useAuthStore.getState().clear()
  }, [])

  return (
    <GuestCard>
      <h1 className="text-ds-lg font-bold text-strong">{GUEST_COPY.endedTitle}</h1>
      <p className="mt-2 text-ds-sm text-gray-300">
        {GUEST_COPY.ended[reason] ?? GUEST_COPY.endedFallback}
      </p>
      <Button
        className="mt-6 min-h-10 w-full"
        onClick={() => {
          useGuestSessionStore.getState().clear()
          navigate('/', { replace: true })
        }}
      >
        {GUEST_COPY.goHome}
      </Button>
    </GuestCard>
  )
}

export default GuestEnded
