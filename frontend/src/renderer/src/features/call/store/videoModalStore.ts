import { create } from 'zustand'

/**
 * "Mudar fundo de vídeo" (`background`) e a prévia antes de ligar a câmera
 * (`preview`, quando "Sempre ver prévia do vídeo" está marcado). Um store só
 * porque os dois abrem do dock da chamada e das configurações.
 */
interface VideoModalState {
  mode: 'background' | 'preview' | null
  openBackground: () => void
  openPreview: () => void
  close: () => void
}

export const useVideoModalStore = create<VideoModalState>()((set) => ({
  mode: null,
  openBackground: () => set({ mode: 'background' }),
  openPreview: () => set({ mode: 'preview' }),
  close: () => set({ mode: null })
}))
