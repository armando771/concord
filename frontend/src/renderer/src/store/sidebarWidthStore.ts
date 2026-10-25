import { create } from 'zustand'
import {
  clampWidth,
  layoutSidebarWidths,
  parseStoredWidth,
  SIDEBARS,
  type SidebarId,
  type SidebarLayoutInput
} from '../lib/sidebarWidth'

// Largura das barras laterais. A preferência é lembrada neste computador; a
// largura de fato (ver layoutSidebarWidths) encolhe com a janela sem mexer nela.

function loadWidth(id: SidebarId): number {
  try {
    return parseStoredWidth(localStorage.getItem(SIDEBARS[id].storageKey), SIDEBARS[id])
  } catch {
    return SIDEBARS[id].defaultWidth
  }
}

function saveWidth(id: SidebarId, width: number): void {
  try {
    localStorage.setItem(SIDEBARS[id].storageKey, String(width))
  } catch {
    // Sem armazenamento: vale só até fechar o app.
  }
}

const viewportWidth = (): number => (typeof window === 'undefined' ? 1280 : window.innerWidth)

interface SidebarWidthState extends SidebarLayoutInput {
  /** Nova preferência (de arrasto ou teclado); salva no localStorage. */
  setPreferred: (id: SidebarId, width: number) => void
  /** Duplo clique na alça: volta ao padrão. */
  resetPreferred: (id: SidebarId) => void
  setMounted: (id: SidebarId, mounted: boolean) => void
  setViewport: (width: number) => void
}

export const useSidebarWidthStore = create<SidebarWidthState>()((set) => ({
  viewport: viewportWidth(),
  preferred: { channels: loadWidth('channels'), members: loadWidth('members') },
  mounted: { channels: false, members: false },
  setPreferred: (id, width) =>
    set((state) => {
      const next = clampWidth(width, SIDEBARS[id])
      saveWidth(id, next)
      if (state.preferred[id] === next) return state
      return { preferred: { ...state.preferred, [id]: next } }
    }),
  resetPreferred: (id) =>
    set((state) => {
      try {
        localStorage.removeItem(SIDEBARS[id].storageKey)
      } catch {
        // idem
      }
      return { preferred: { ...state.preferred, [id]: SIDEBARS[id].defaultWidth } }
    }),
  setMounted: (id, mounted) =>
    set((state) =>
      state.mounted[id] === mounted ? state : { mounted: { ...state.mounted, [id]: mounted } }
    ),
  setViewport: (viewport) => set((state) => (state.viewport === viewport ? state : { viewport }))
}))

/** Largura de fato da barra (primitivo: só re-renderiza quando muda). */
export const selectSidebarWidth =
  (id: SidebarId) =>
  (state: SidebarLayoutInput): number =>
    layoutSidebarWidths(state)[id]

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    useSidebarWidthStore.getState().setViewport(window.innerWidth)
  })
}
