import { create } from 'zustand'

// Confirmações de expulsar e banir (abertas pelo menu da pessoa e pela aba
// Membros das configurações do servidor; quem desenha é o ModerationHost).

export interface ModerationTarget {
  serverId: string
  userId: string
  name: string
}

interface ModerationState {
  kick: ModerationTarget | null
  ban: ModerationTarget | null
  askKick: (target: ModerationTarget) => void
  askBan: (target: ModerationTarget) => void
  closeKick: () => void
  closeBan: () => void
}

export const useModerationStore = create<ModerationState>()((set) => ({
  kick: null,
  ban: null,
  askKick: (kick) => set({ kick }),
  askBan: (ban) => set({ ban }),
  closeKick: () => set({ kick: null }),
  closeBan: () => set({ ban: null })
}))
