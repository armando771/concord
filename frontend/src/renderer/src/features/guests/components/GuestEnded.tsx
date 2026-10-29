import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../shared/ui/Button'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../../call/store/callStore'
import { endedTexts, GUEST_COPY } from '../lib/guestCopy'
import { useGuestSessionStore } from '../store/guestSessionStore'
import GuestCard from './GuestCard'

/**
 * A tela final do visitante sem conta (saiu ou o acesso acabou): sai da call,
 * descarta a sessão de visitante e oferece criar conta ou entrar.
 */
function GuestEnded({ reason }: { reason: string }): React.JSX.Element {
  const navigate = useNavigate()
  useEffect(() => {
    useCallStore.getState().endCall()
    if (useGuestSessionStore.getState().anonymous) useAuthStore.getState().clear()
  }, [])
  const go = (path: string): void => {
    useGuestSessionStore.getState().clear()
    navigate(path, { replace: true })
  }
  const texts = endedTexts(reason)

  return (
    <GuestCard>
      <h1 className="text-ds-lg font-bold text-strong">{texts.title}</h1>
      <p className="mt-2 text-ds-sm text-gray-300">{texts.body}</p>
      <p className="mt-4 text-ds-sm text-gray-400">{GUEST_COPY.finalPitch}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Button className="min-h-10 w-full" onClick={() => go('/register')}>
          {GUEST_COPY.createAccount}
        </Button>
        <Button variant="ghost" className="min-h-10 w-full" onClick={() => go('/login')}>
          {GUEST_COPY.signIn}
        </Button>
      </div>
    </GuestCard>
  )
}

export default GuestEnded
