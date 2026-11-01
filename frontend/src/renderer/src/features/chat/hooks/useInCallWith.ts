import { useCallStore } from '../../call/store/callStore'

/** Está numa chamada de DM com esta pessoa? */
export function useInCallWith(userId: string | undefined): boolean {
  return useCallStore(
    (s) => s.status !== 'idle' && s.type === 'dm' && s.participants.some((p) => p.id === userId)
  )
}
