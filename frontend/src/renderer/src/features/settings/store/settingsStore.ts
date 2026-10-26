import { create } from 'zustand'
import type { SettingsSectionId } from '../lib/settingsNav'

// Tela de Configurações (tela cheia, como no Discord). Aberta pela engrenagem
// da barra de baixo e pelo "Editar perfil" do cartão.

interface SettingsState {
  open: boolean
  section: SettingsSectionId
  /** O editor de perfil tem alterações não salvas. */
  dirty: boolean
  /** Sobe a cada tentativa de sair com alterações: a barra treme. */
  blockedAt: number
  openSettings: (section?: SettingsSectionId) => void
  /** Troca de seção; com alterações pendentes não deixa (e a barra treme). */
  goTo: (section: SettingsSectionId) => void
  /** Fecha; com alterações pendentes não deixa (e a barra treme). */
  close: () => void
  setDirty: (dirty: boolean) => void
  /** Fecha sem perguntar (sair da conta). */
  forceClose: () => void
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  const blocked = (): boolean => {
    if (!get().dirty) return false
    set({ blockedAt: Date.now() })
    return true
  }
  return {
    open: false,
    section: 'account',
    dirty: false,
    blockedAt: 0,
    openSettings: (section = 'account') => {
      if (get().open && get().section !== section && blocked()) return
      set({ open: true, section })
    },
    goTo: (section) => {
      if (section === get().section || blocked()) return
      set({ section })
    },
    close: () => {
      if (blocked()) return
      set({ open: false })
    },
    setDirty: (dirty) => set({ dirty }),
    forceClose: () => set({ open: false, dirty: false })
  }
})
