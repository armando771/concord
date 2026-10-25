import { useEffect, useMemo } from 'react'
import { mergeCallPeople } from '../lib/callParticipants'
import { buildOverlaySnapshot } from '../lib/overlayState'
import { useAuthStore } from '../store/authStore'
import { useCallStore } from '../store/callStore'
import { useOverlayPrefsStore } from '../store/overlayPrefsStore'
import { useServerStore } from '../store/serverStore'

/**
 * Manda ao main o estado da call para o overlay de jogo (só Windows). A lista
 * é a mesma do palco: backend + quem está na sala de mídia.
 */
function OverlayBridge(): null {
  const overlay = window.api?.overlay
  const enabled = useOverlayPrefsStore((s) => s.enabled)
  const opacity = useOverlayPrefsStore((s) => s.opacity)
  const me = useAuthStore((s) => s.user)
  const status = useCallStore((s) => s.status)
  const backendParticipants = useCallStore((s) => s.participants)
  const mediaPeers = useCallStore((s) => s.mediaPeers)
  const voiceStates = useCallStore((s) => s.voiceStates)
  const speakingIds = useCallStore((s) => s.speakingIds)
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const members = useServerStore((s) => s.currentMembers)

  const meId = me?.id ?? null
  const participants = useMemo(
    () =>
      mergeCallPeople(backendParticipants, mediaPeers, meId, (id) => {
        const m = members.find((x) => x.user_id === id)
        return m?.display_name || m?.username
      }),
    [backendParticipants, mediaPeers, meId, members]
  )

  useEffect(() => {
    if (!overlay?.supported) return
    overlay.setState(
      buildOverlaySnapshot({
        enabled,
        status,
        me,
        participants,
        voiceStates,
        speakingIds,
        muted,
        deafened,
        opacity
      })
    )
  }, [
    overlay,
    enabled,
    opacity,
    status,
    me,
    participants,
    voiceStates,
    speakingIds,
    muted,
    deafened
  ])

  return null
}

export default OverlayBridge
