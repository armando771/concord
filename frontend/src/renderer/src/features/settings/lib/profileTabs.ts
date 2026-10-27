// Abas do editor de Configurações → Perfis.

export type ProfileTab = 'identity' | 'appearance'

export const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'identity', label: 'Identidade' },
  { id: 'appearance', label: 'Aparência' }
]

export const tabId = (tab: ProfileTab): string => `profile-tab-${tab}`
export const panelId = (tab: ProfileTab): string => `profile-panel-${tab}`

/** A aba vizinha pela seta (dá a volta nas pontas). */
export function nextTab(current: ProfileTab, key: string): ProfileTab | null {
  const step = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0
  if (step === 0) return null
  const i = PROFILE_TABS.findIndex((t) => t.id === current)
  return PROFILE_TABS[(i + step + PROFILE_TABS.length) % PROFILE_TABS.length].id
}
