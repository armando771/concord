import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { inviteCodeFromSearch } from '../lib/inviteLink'
import { useInviteLinkStore } from '../store/inviteLinkStore'

function RedirectIfAuthed({ children }: { children: React.ReactElement }): React.JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken)
  const inviteCode = inviteCodeFromSearch(useLocation().search)
  // Já logado num /login?convite=…: segue direto para a confirmação.
  useEffect(() => {
    if (accessToken && inviteCode) useInviteLinkStore.getState().open(inviteCode)
  }, [accessToken, inviteCode])
  if (accessToken) return <Navigate to="/" replace />
  return children
}

export default RedirectIfAuthed
