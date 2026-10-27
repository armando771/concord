import { hasErrors, type ProfileErrors } from '../../profile/lib/profileValidation'

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

const CARD_ONLY = new Set(['display_name', 'pronouns'])

/** A aba que tem campo com erro. Nome e pronomes se editam no cartão (não contam). */
export function tabAlert(errors: ProfileErrors): ProfileTab | null {
  const identity = Object.fromEntries(
    Object.entries(errors).filter(([key]) => !CARD_ONLY.has(key))
  ) as ProfileErrors
  return hasErrors(identity) ? 'identity' : null
}

/** Aviso embaixo do cartão quando o erro está numa parte que só se edita nele. */
export function cardNotice(errors: ProfileErrors): string | null {
  if (!errors.display_name && !errors.pronouns) return null
  return 'Tem algo para corrigir no nome ou nos pronomes: clique neles no cartão.'
}
