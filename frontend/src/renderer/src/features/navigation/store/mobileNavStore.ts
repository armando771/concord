import { create } from 'zustand'
import {
  initialPanel,
  panelAfterNavigation,
  type MobilePanel,
  type NavigationAction
} from '../lib/mobileNav'

/** O caminho da rota: no navegador é o pathname; no desktop (HashRouter), o que vem depois do #. */
export function pathFromLocation(loc: { pathname: string; hash: string }): string {
  return loc.hash.startsWith('#/') ? loc.hash.slice(1) : loc.pathname
}

function startPanel(): MobilePanel {
  return typeof window === 'undefined' ? 'nav' : initialPanel(pathFromLocation(window.location))
}

interface MobileNavState {
  /** Coluna da frente no celular (no desktop as duas aparecem). */
  panel: MobilePanel
  /** Gaveta da direita (membros) aberta no celular/tablet. */
  membersOpen: boolean
  showNav: () => void
  showContent: () => void
  setMembersOpen: (open: boolean) => void
  /** Chamado a cada troca de rota (useMobileNavSync). */
  navigated: (nav: { prev: string; next: string; action: NavigationAction }) => void
}

/** Navegação do celular: qual coluna está na frente e a gaveta de membros. */
export const useMobileNavStore = create<MobileNavState>((set) => ({
  panel: startPanel(),
  membersOpen: false,
  showNav: () => set({ panel: 'nav', membersOpen: false }),
  showContent: () => set({ panel: 'content' }),
  setMembersOpen: (open) => set({ membersOpen: open }),
  navigated: (nav) =>
    set((s) => ({ panel: panelAfterNavigation(nav, s.panel), membersOpen: false }))
}))
