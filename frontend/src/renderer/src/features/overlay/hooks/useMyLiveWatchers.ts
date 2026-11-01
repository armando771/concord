import { useMemo } from 'react'
import { useCallStore } from '../../call/store/callStore'
import { useOverlayPrefsStore } from '../store/overlayPrefsStore'
import type { MyLiveInput } from '../lib/overlayWatchers'

const NO_WATCHERS: never[] = []

/**
 * Minha live e quem a assiste, para o overlay. O backend manda
 * `call:screen_watchers` ao app (o overlay não tem WS): o callStore guarda e
 * o bridge repassa pela ponte com o main.
 */
export function useMyLiveWatchers(meId: string | null): Omit<MyLiveInput, 'meId'> {
  const live = useCallStore((s) => s.isScreenSharing)
  const show = useOverlayPrefsStore((s) => s.showWatchers)
  const watchers = useCallStore((s) => (meId ? s.screenWatchers[meId] : undefined)) ?? NO_WATCHERS
  return useMemo(() => ({ live, show, watchers }), [live, show, watchers])
}
