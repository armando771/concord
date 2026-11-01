import { Navigate } from 'react-router-dom'
import { anonymousGuestLink, useGuestSessionStore } from '../store/guestSessionStore'

/**
 * Visitante sem conta só tem a call: abrir qualquer outra tela do app volta
 * para a tela do link (antes de o app tentar carregar a conta, que o servidor
 * recusaria e derrubaria a sessão de visitante).
 */
function GuestSessionGate({ children }: { children: React.ReactElement }): React.JSX.Element {
  const link = useGuestSessionStore(anonymousGuestLink)
  if (link) return <Navigate to={`/visitante/${link}`} replace />
  return children
}

export default GuestSessionGate
