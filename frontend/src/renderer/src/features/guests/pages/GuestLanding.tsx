import { Navigate, useParams } from 'react-router-dom'
import { validGuestToken } from '../lib/guestLink'
import { useGuestSessionStore } from '../store/guestSessionStore'
import GuestCallScreen from '../components/GuestCallScreen'
import GuestEnded from '../components/GuestEnded'
import GuestJoinCard from '../components/GuestJoinCard'

/**
 * /visitante/<token>: o link de convite de visitante. Abre sem login (no app
 * web, sem instalar nada). Antes de entrar, o cartão; depois, só a call.
 */
function GuestLanding(): React.JSX.Element {
  const { token } = useParams()
  if (!validGuestToken(token)) return <Navigate to="/" replace />
  return <GuestFlow token={token} />
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
