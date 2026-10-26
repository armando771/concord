import { create } from 'zustand'
import { canCopyImage } from '../lib/attachments'

// Botão direito numa imagem de chat: menu com "Copiar imagem".

export interface ImageMenuTarget {
  attachmentId: string
  contentType: string
  x: number
  y: number
}

interface ImageMenuState {
  target: ImageMenuTarget | null
  open: (target: ImageMenuTarget) => void
  close: () => void
}

export const useImageMenuStore = create<ImageMenuState>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null })
}))

/**
 * onContextMenu de uma imagem de chat. Sempre cancela o menu do navegador e não
 * deixa o clique subir para a linha (que abriria o menu do autor). O menu só
 * aparece se o formato pode ser copiado.
 */
export function imageMenuHandler(
  attachmentId: string,
  contentType: string
): (e: React.MouseEvent) => void {
  return (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canCopyImage(contentType)) return
    useImageMenuStore.getState().open({ attachmentId, contentType, x: e.clientX, y: e.clientY })
  }
}
