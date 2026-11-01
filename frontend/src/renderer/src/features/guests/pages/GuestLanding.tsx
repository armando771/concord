import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { validGuestToken } from '../lib/guestLink'
import { hasAccount } from '../lib/guestSession'
import { useGuestLinkStore } from '../store/guestLinkStore'
import { useGuestSessionStore } from '../store/guestSessionStore'
import GuestCallScreen from '../components/GuestCallScreen'
import GuestEnded from '../components/GuestEnded'
import GuestJoinCard from '../components/GuestJoinCard'

/**
 * /visitante/<token>: o link de convite de visitante. Sem conta (no app web,
 * sem instalar nada): o cartão e depois só a call. Com conta: a confirmação
 * dentro do app, que continua inteiro.
 */
function GuestLanding(): React.JSX.Element | null {
  const { token } = useParams()
  const accessToken = useAuthStore((s) => s.accessToken)
  const anonymous = useGuestSessionStore((s) => s.anonymous)
  if (!validGuestToken(token)) return <Navigate to="/" replace />
  if (hasAccount(accessToken, anonymous)) return <ConfirmInApp token={token} />
  return <GuestFlow token={token} />
}

/** Quem tem conta: abre a confirmação no app (GuestVisitConfirmModal). */
function ConfirmInApp({ token }: { token: string }): null {
  const navigate = useNavigate()
  useEffect(() => {
    useGuestLinkStore.getState().open(token)
    navigate('/', { replace: true })
  }, [token, navigate])
  return null
}

function GuestFlow({ token }: { token: string }): React.JSX.Element {
  const link = useGuestSessionStore((s) => s.link)
  const pass = useGuestSessionStore((s) => s.pass)
  const ended = useGuestSessionStore((s) => s.ended)
  const mine = link === token
  if (mine && ended) return <GuestEnded reason={ended} />
  if (mine && pass) return <GuestCallScreen pass={pass} />
  return <GuestJoinCard token={token} />
}

export default GuestLanding
