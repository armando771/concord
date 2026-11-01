import { create } from 'zustand'

interface NetworkState {
  /** false só quando o sistema diz que está sem rede (desconhecido conta como online). */
  online: boolean
  setOnline: (online: boolean) => void
}

export const useNetworkStore = create<NetworkState>()((set) => ({
  online: true,
  setOnline: (online) => set({ online })
}))
