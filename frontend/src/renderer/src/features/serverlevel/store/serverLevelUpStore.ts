import { create } from 'zustand'

/** Subida de nível do servidor que a animação está mostrando agora. */
export interface ServerLevelUpShow {
  /** Muda a cada animação, para reiniciar. */
  key: number
  serverId: string
  level: number
  /** De onde a contagem começa (o último nível que você viu). */
  previous: number
}

interface ServerLevelUpState {
  current: ServerLevelUpShow | null
  show: (up: Omit<ServerLevelUpShow, 'key'>) => void
  /** Fecha (clique, Esc ou fim da animação). Só fecha a animação `key`, se vier. */
  close: (key?: number) => void
}

let seq = 0

export const useServerLevelUpStore = create<ServerLevelUpState>((set, get) => ({
  current: null,
  show: (up) => set({ current: { ...up, key: ++seq } }),
  close: (key) => {
    if (key === undefined || get().current?.key === key) set({ current: null })
  }
}))
