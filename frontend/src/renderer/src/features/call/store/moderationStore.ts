import { create } from 'zustand'

// Confirmações de expulsar e banir e a janela de apelido (abertas pelo menu da
// pessoa, pelo cartão de perfil e pela aba Membros das configurações do
// servidor; quem desenha é o ModerationHost).

export interface ModerationTarget {
  serverId: string
  userId: string
  name: string
}

/** Janela "Alterar apelido": de quem, como aparece hoje e o nome de verdade. */
export interface NicknameTarget extends ModerationTarget {
  /** Apelido atual (null = sem). */
  nickname: string | null
  /** Nome de exibição de verdade (vale quando não há apelido). */
  displayName: string
  self: boolean
}

interface ModerationState {
  kick: ModerationTarget | null
  ban: ModerationTarget | null
  nickname: NicknameTarget | null
  askKick: (target: ModerationTarget) => void
  askBan: (target: ModerationTarget) => void
  askNickname: (target: NicknameTarget) => void
  closeKick: () => void
  closeBan: () => void
  closeNickname: () => void
}

export const useModerationStore = create<ModerationState>()((set) => ({
  kick: null,
  ban: null,
  nickname: null,
  askKick: (kick) => set({ kick }),
  askBan: (ban) => set({ ban }),
  askNickname: (nickname) => set({ nickname }),
  closeKick: () => set({ kick: null }),
  closeBan: () => set({ ban: null }),
  closeNickname: () => set({ nickname: null })
}))
