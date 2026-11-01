import { useShallow } from 'zustand/react/shallow'
import { useNow } from '../../../shared/hooks/useNow'
import type { GuestPass } from '../api/guestInvites'
import { liveVisits, visitOf } from '../lib/guestVisits'
import { useGuestVisitsStore } from '../store/guestVisitsStore'

/** As visitas que ainda valem (o trilho tira a vencida mesmo antes do aviso). */
export function useLiveVisits(): GuestPass[] {
  const now = useNow(30_000)
  return useGuestVisitsStore(useShallow((s) => liveVisits(s.visits, now)))
}

/** A visita ativa no servidor (ou null). */
export function useVisit(serverId: string | null | undefined): GuestPass | null {
  const now = useNow(30_000)
  return useGuestVisitsStore((s) => visitOf(s.visits, serverId ?? undefined, now))
}
