import { useCallback } from 'react'
import { roomValue } from '../lib/roomState'
import { useDraftStore } from '../store/draftStore'

/** O texto do campo de mensagem da sala, no lugar do useState('') do ChatPane. */
export function useRoomDraft(room: string): [string, (next: string | ((prev: string) => string)) => void] {
  const draft = useDraftStore((s) => roomValue(s.byRoom, room, ''))
  const setDraft = useCallback(
    (next: string | ((prev: string) => string)) => useDraftStore.getState().update(room, next),
    [room]
  )
  return [draft, setDraft]
}
