import { Navigate, useParams } from 'react-router-dom'
import { useServerStore } from '../../servers/store/serverStore'
import { visitPath } from '../lib/guestVisits'
import { useVisit } from '../hooks/useGuestVisits'

/**
 * Servidor em que a conta é só visitante (painel "Voz conectada",
 * notificação...): abre a visita, não a tela do servidor (que o servidor
 * recusaria).
 */
function GuestVisitRedirect({ children }: { children: React.ReactElement }): React.JSX.Element {
  const { id } = useParams()
  const visit = useVisit(id)
  const member = useServerStore((s) => s.servers.some((srv) => srv.id === id))
  if (visit && !member) return <Navigate to={visitPath(visit.server_id)} replace />
  return children
}

export default GuestVisitRedirect
