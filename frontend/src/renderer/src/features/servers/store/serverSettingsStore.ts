import { create } from 'zustand'
import type { ServerSettingsSectionId } from '../lib/serverSettingsNav'

// Configurações do servidor em tela cheia (menu do nome do servidor).

interface ServerSettingsState {
  open: boolean
  section: ServerSettingsSectionId
  openSettings: (section?: ServerSettingsSectionId) => void
  goTo: (section: ServerSettingsSectionId) => void
  close: () => void
}

export const useServerSettingsStore = create<ServerSettingsState>()((set) => ({
  open: false,
  section: 'overview',
  openSettings: (section = 'overview') => set({ open: true, section }),
  goTo: (section) => set({ section }),
  close: () => set({ open: false })
}))
