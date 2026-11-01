import { useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { joinAsGuest } from '../api/guestInvites'
import { guestErrorMessage } from '../lib/guestErrors'
import { guestAsUser } from '../lib/guestSession'
import { useGuestSessionStore } from '../store/guestSessionStore'

export interface GuestJoin {
  joining: boolean
  error: string | null
  join: (displayName: string) => Promise<void>
}

/** Sem conta: entra com o nome digitado e vira a sessão de visitante. */
async function enterAsGuest(token: string, displayName: string): Promise<void> {
  const session = await joinAsGuest(token, displayName)
  useAuthStore.setState({
    accessToken: session.token,
    refreshToken: null,
    user: guestAsUser(session)
  })
  useGuestSessionStore.getState().start(token, session.pass)
}

/**
 * Entrar pelo link sem conta. Quem tem conta nem chega aqui: a confirmação
 * é dentro do app (GuestVisitConfirmModal).
 */
export function useGuestJoin(token: string): GuestJoin {
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const join = async (displayName: string): Promise<void> => {
    setJoining(true)
    setError(null)
    try {
      await enterAsGuest(token, displayName)
    } catch (err) {
      setError(guestErrorMessage(err, 'Não foi possível entrar na call.'))
    } finally {
      setJoining(false)
    }
  }

  return { joining, error, join }
}
