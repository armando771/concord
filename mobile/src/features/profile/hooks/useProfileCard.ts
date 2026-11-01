import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { getProfile } from '../api/users'
import type { ProfileData } from '../lib/profileTypes'
import { useProfileCardStore } from '../store/profileCardStore'

export type ProfileCardStatus = 'loading' | 'ready' | 'error'

export interface ProfileCardResult {
  profile: ProfileData | null
  status: ProfileCardStatus
  reload: () => void
}

/**
 * O cartão de uma pessoa. O do próprio usuário vem da sessão. O dos outros abre com o último cartão
 * visto (se houver) e recarrega em seguida; erro só aparece quando não há nada para mostrar.
 */
export function useProfileCard(userId: string): ProfileCardResult {
  const me = useAuthStore((s) => s.user)
  const cached = useProfileCardStore((s) => s.cards[userId])
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const isMe = me?.id === userId

  useEffect(() => {
    if (isMe) return
    let live = true
    const { epoch } = useProfileCardStore.getState()
    getProfile(userId)
      .then((profile) => {
        const store = useProfileCardStore.getState()
        if (store.epoch === epoch) store.put(profile)
      })
      .catch(() => live && setFailedFor(userId))
    return () => {
      live = false
    }
  }, [userId, isMe, attempt])

  const reload = useCallback(() => {
    setFailedFor(null)
    setAttempt((n) => n + 1)
  }, [])

  const profile = isMe ? me : (cached ?? null)
  if (profile) return { profile, status: 'ready', reload }
  return { profile: null, status: failedFor === userId ? 'error' : 'loading', reload }
}
