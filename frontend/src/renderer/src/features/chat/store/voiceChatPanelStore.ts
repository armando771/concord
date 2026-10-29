import { create } from 'zustand'

/**
 * Painel do chat do canal de voz (à direita da tela da chamada). Um canal por
 * vez; as mensagens são as do próprio canal (sala channel:<id do canal de voz>).
 */
interface VoiceChatPanelState {
  /** Canal de voz com o chat aberto (null = fechado). */
  channelId: string | null
  open: (channelId: string) => void
  close: () => void
  /** Botão da tela da chamada: abre o chat deste canal ou fecha se já está aberto. */
  toggle: (channelId: string) => void
}

export const useVoiceChatPanelStore = create<VoiceChatPanelState>((set, get) => ({
  channelId: null,
  open: (channelId) => set({ channelId }),
  close: () => set({ channelId: null }),
  toggle: (channelId) => set({ channelId: get().channelId === channelId ? null : channelId })
}))

export const isVoiceChatOpen =
  (channelId: string) =>
  (s: Pick<VoiceChatPanelState, 'channelId'>): boolean =>
    s.channelId === channelId
