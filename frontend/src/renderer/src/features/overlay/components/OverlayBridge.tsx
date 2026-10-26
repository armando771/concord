import { useEffect, useMemo } from 'react'
import { mergeCallPeople } from '../../call/lib/callParticipants'
import { buildOverlaySnapshot } from '../lib/overlayState'
import { serverDisplayName, withServerNames } from '../../servers/lib/serverNames'
import { useCallNicknames } from '../../servers/hooks/useServerNames'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../../call/store/callStore'
import { useOverlayPrefsStore } from '../store/overlayPrefsStore'
import { useServerStore } from '../../servers/store/serverStore'

/**
 * Manda ao main o estado da call para o overlay de jogo (só Windows). A lista
 * é a mesma do palco: backend + quem está na sala de mídia.
 */
function OverlayBridge(): null {
  const overlay = window.api?.overlay
  const enabled = useOverlayPrefsStore((s) => s.enabled)
  const opacity = useOverlayPrefsStore((s) => s.opacity)
  const layout = useOverlayPrefsStore((s) => s.layout)
  const shortcut = useOverlayPrefsStore((s) => s.shortcut)
  const setLayout = useOverlayPrefsStore((s) => s.setLayout)
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
  // Call num canal de voz: apelidos daquele servidor (mesmo olhando outro).
  const nicknames = useCallNicknames()
  const participants = useMemo(
    () =>
      withServerNames(
        mergeCallPeople(backendParticipants, mediaPeers, meId, (id) => {
          const m = members.find((x) => x.user_id === id)
          return m?.display_name || m?.username
        }),
        nicknames
      ),
    [backendParticipants, mediaPeers, meId, members, nicknames]
  )
  const meInOverlay = useMemo(
    () =>
      me && meId && nicknames?.[meId]
        ? { ...me, display_name: serverDisplayName({ nickname: nicknames[meId] }, me) }
        : me,
    [me, meId, nicknames]
  )

  // Posição/tamanho editados no jogo (Shift+Tab) chegam pelo main: salva aqui.
  useEffect(() => {
    if (!overlay?.supported) return
    return overlay.onLayout(setLayout)
  }, [overlay, setLayout])

  useEffect(() => {
    if (!overlay?.supported) return
    overlay.setState(
      buildOverlaySnapshot({
        enabled,
        status,
        me: meInOverlay,
        participants,
        voiceStates,
        speakingIds,
        muted,
        deafened,
        opacity,
        layout,
        shortcut
      })
    )
  }, [
    overlay,
    enabled,
    opacity,
    layout,
    shortcut,
    status,
    meInOverlay,
    participants,
    voiceStates,
    speakingIds,
    muted,
    deafened
  ])

  return null
}

export default OverlayBridge
