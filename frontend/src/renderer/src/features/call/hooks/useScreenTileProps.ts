import type { MouseEvent } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { streamMenuHandler } from '../../profile/store/userMenuStore'
import { useCallStore } from '../store/callStore'
import type { CallUserInfo } from '../store/callStore'
import { streamAudioKey, useUserAudioStore } from '../store/userAudioStore'

const NO_WATCHERS: CallUserInfo[] = []

/** O que todo tile de transmissão tem: espectadores, mute local e menu de contexto. */
export function useScreenTileProps(user: CallUserInfo): {
  watchers: CallUserInfo[]
  locallyMuted: boolean
  onContextMenu: ((e: MouseEvent) => void) | undefined
} {
  const meId = useAuthStore((s) => s.user?.id ?? 'me')
  const watchers = useCallStore((s) => s.screenWatchers[user.id] ?? NO_WATCHERS)
  const locallyMuted = useUserAudioStore(
    (s) => s.settings[streamAudioKey(user.id)]?.muted ?? false
  )
  return {
    watchers,
    locallyMuted,
    onContextMenu: streamMenuHandler(user.id, user.display_name, meId)
  }
}
