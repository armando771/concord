import type { CallUserInfo } from '../../call/store/callStore'
import { useIsGuest } from '../store/guestRosterStore'
import { GUEST_COPY } from '../lib/guestCopy'

/** O participante com "· Visitante" no nome do tile (quem entrou por link). */
export function guestTagged(user: CallUserInfo, guest: boolean): CallUserInfo {
  if (!guest) return user
  return { ...user, display_name: `${user.display_name} · ${GUEST_COPY.badge}`, name_style: null }
}

export function useGuestTagged(user: CallUserInfo): CallUserInfo {
  return guestTagged(user, useIsGuest(user.id))
}
