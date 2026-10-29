import { create } from 'zustand'

/** Quem está na call em que estou como visitante (selo "Visitante" nos tiles). */
interface GuestRosterState {
  ids: string[]
  set: (ids: string[]) => void
}

export const useGuestRosterStore = create<GuestRosterState>((set) => ({
  ids: [],
  set: (ids) => set({ ids })
}))

/** O selo de um participante. */
export function useIsGuest(userId: string): boolean {
  return useGuestRosterStore((s) => s.ids.includes(userId))
}
