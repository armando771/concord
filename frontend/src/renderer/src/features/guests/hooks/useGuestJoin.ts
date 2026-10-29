import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { joinAsGuest, joinWithAccount } from '../api/guestInvites'
import { alreadyMemberPath, guestErrorMessage } from '../lib/guestErrors'
import { guestAsUser, hasAccount } from '../lib/guestSession'
import { useGuestSessionStore } from '../store/guestSessionStore'

export interface GuestJoin {
  /** Tem conta logada: entra com ela (sem nome). */
  withAccount: boolean
  accountName: string | null
  joining: boolean
  error: string | null
  join: (displayName: string) => Promise<void>
}

/** Entrar pelo link: com a conta logada ou, sem ela, com o nome digitado. */
export function useGuestJoin(token: string): GuestJoin {
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const accountName = useAuthStore((s) => s.user?.display_name ?? null)
  const anonymous = useGuestSessionStore((s) => s.anonymous)
  const withAccount = hasAccount(accessToken, anonymous)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const asAccount = async (): Promise<void> => {
    try {
      const { pass } = await joinWithAccount(token)
      useGuestSessionStore.getState().start(token, pass, false)
    } catch (err) {
      // Já é membro: abre o canal de voz normalmente.
      const memberPath = alreadyMemberPath(err)
      if (!memberPath) throw err
      navigate(memberPath, { replace: true })
    }
  }

  const asGuest = async (displayName: string): Promise<void> => {
    const session = await joinAsGuest(token, displayName)
    useAuthStore.setState({
      accessToken: session.token,
      refreshToken: null,
      user: guestAsUser(session)
    })
    useGuestSessionStore.getState().start(token, session.pass, true)
  }

  const join = async (displayName: string): Promise<void> => {
    setJoining(true)
    setError(null)
    try {
      await (withAccount ? asAccount() : asGuest(displayName))
    } catch (err) {
      setError(guestErrorMessage(err, 'Não foi possível entrar na call.'))
    } finally {
      setJoining(false)
    }
  }

  return { withAccount, accountName, joining, error, join }
}
