import { useBoostStore } from '../../store/boostStore'
import { useCallStore } from '../../store/callStore'

/** Percentual do buff de XP da call em que você está (100 = sem buff). */
export function useMyBoostPercent(): number {
  const callId = useCallStore((s) => s.callId)
  return useBoostStore((s) => (callId ? s.byCall[callId]?.percent : undefined) ?? 100)
}
