import { useEffect } from 'react'
import { useCallStore } from '../../call/store/callStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../../chat/store/chatStore'
import { API_BASE_URL } from '../../../shared/lib/config'
import { ApiError } from '../../../shared/api/client'
import { createCallResumer } from '../lib/updateCallResume'
import { useCallResumeStore } from '../store/callResumeStore'
import { showToast } from '../../../shared/store/toastStore'
import router from '../../../app/router'
import type { PendingCallResume } from '../../../../../shared/callResume'

// Compartilhado entre os efeitos: StrictMode não pode consumir a retomada duas vezes.
let resumePromise: Promise<PendingCallResume | null> | undefined

export default function UpdateCallBridge(): null {
  useEffect(() => {
    const updates = window.api?.updates
    if (!updates) return
    const sync = (): void => {
      const call = useCallStore.getState()
      const user = useAuthStore.getState().user
      updates.setCallSnapshot(
        user &&
          call.status === 'active' &&
          call.type === 'channel' &&
          call.serverId &&
          call.channelId
          ? {
              userId: user.id,
              backendUrl: API_BASE_URL,
              serverId: call.serverId,
              channelId: call.channelId,
              muted: call.muted,
              deafened: call.deafened,
              mutedBeforeDeafen: call.mutedBeforeDeafen
            }
          : null
      )
    }
    const resumer = createCallResumer({
      take: () => (resumePromise ??= updates.takeCallResume()),
      context: () => ({
        userId: useAuthStore.getState().user?.id ?? null,
        backendUrl: API_BASE_URL,
        connected: useChatStore.getState().isWsConnected(),
        idle: useCallStore.getState().status === 'idle'
      }),
      join: async (resume, signal) => {
        await useCallStore.getState().startChannelCall(resume.channelId, resume, signal)
        const call = useCallStore.getState()
        if (call.status !== 'active' || call.channelId !== resume.channelId) {
          throw new Error('Retomada cancelada')
        }
      },
      navigate: (resume) => {
        void router.navigate(`/servers/${resume.serverId}/channels/${resume.channelId}`)
      },
      permanent: (error) => error instanceof ApiError && [401, 403, 404].includes(error.status),
      failed: () => showToast.error('Não foi possível voltar automaticamente ao canal de voz.')
    })
    sync()
    const offCall = useCallStore.subscribe((state, previous) => {
      if (previous.callId && state.status === 'idle') resumer.cancel()
      if (
        state.status !== previous.status ||
        state.channelId !== previous.channelId ||
        state.serverId !== previous.serverId ||
        state.muted !== previous.muted ||
        state.deafened !== previous.deafened ||
        state.mutedBeforeDeafen !== previous.mutedBeforeDeafen
      )
        sync()
    })
    const offAuth = useAuthStore.subscribe((state, previous) => {
      if ((previous.user && state.user?.id !== previous.user.id) || !state.accessToken)
        resumer.cancel()
      sync()
    })
    void resumer.tick()
    const timer = setInterval(() => {
      void resumer.tick().then(() => {
        if (resumer.settled()) useCallResumeStore.getState().markSettled()
      })
    }, 1000)
    return () => {
      clearInterval(timer)
      resumer.cancel()
      offCall()
      offAuth()
    }
  }, [])
  return null
}
