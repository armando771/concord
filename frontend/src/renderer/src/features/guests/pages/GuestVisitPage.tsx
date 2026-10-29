import { Navigate, useParams } from 'react-router-dom'
import MobileBackFrame from '../../navigation/components/MobileBackFrame'
import { InviteSpinner } from '../../servers/components/InviteServerInfo'
import { useVisit } from '../hooks/useGuestVisits'
import { useGuestVisitsStore } from '../store/guestVisitsStore'
import GuestVisitView from '../components/GuestVisitView'

/**
 * /visitas/<servidor>: a visita de quem tem conta (link de visitante), dentro
 * do app. Acabou ou não existe: volta para o Início.
 */
function GuestVisitPage(): React.JSX.Element {
  const { serverId } = useParams()
  const visit = useVisit(serverId)
  const loaded = useGuestVisitsStore((s) => s.loaded)
  if (visit) {
    return (
      <MobileBackFrame>
        <GuestVisitView visit={visit} />
      </MobileBackFrame>
    )
  }
  if (loaded) return <Navigate to="/friends" replace />
  return (
    <div role="status" className="flex h-full items-center justify-center">
      <InviteSpinner />
    </div>
  )
}

export default GuestVisitPage
