import { create } from 'zustand'
import { roomUpdate, type RoomMap } from '../lib/roomState'

// Rascunho do campo de mensagem de cada sala (canal, DM ou grupo). Fica aqui, e
// não no ChatPane, para o texto não passar de uma sala para outra ao trocar e
// para voltar quando a pessoa reabre a sala, como no Discord. Só em memória.

interface DraftState {
  byRoom: RoomMap<string>
  update: (room: string, next: string | ((prev: string) => string)) => void
  /** Ao sair da conta: rascunho de uma conta não passa para a próxima. */
  clear: () => void
}

export const useDraftStore = create<DraftState>()((set) => ({
  byRoom: {},
  update: (room, next) =>
    set((s) => {
      const byRoom = roomUpdate(s.byRoom, room, '', next)
      return byRoom === s.byRoom ? s : { byRoom }
    }),
  clear: () => set({ byRoom: {} })
}))
