import type { FriendsTab } from '../../../shared/store/uiStore'

export const FRIENDS_TABS: FriendsTab[] = ['online', 'all', 'pending', 'invites', 'blocked', 'add']

/** Aba pedida na URL (/friends?tab=...), ou null se não existir. */
export function parseFriendsTab(raw: string | null): FriendsTab | null {
  return FRIENDS_TABS.find((t) => t === raw) ?? null
}

/** A caixa "Buscar" filtra pessoas: não faz sentido em "Adicionar amigo" nem em convites. */
export function tabHasSearch(tab: FriendsTab): boolean {
  return tab !== 'add' && tab !== 'invites'
}

/** Classes do botão de aba (ativa x inativa). */
export function tabClass(active: boolean): string {
  return active ? 'bg-fg/10 text-strong' : 'text-gray-400 hover:bg-fg/5 hover:text-gray-200'
}

/** O botão verde "Adicionar amigo" vira texto verde quando a aba está aberta. */
export function addTabClass(active: boolean): string {
  return active
    ? 'bg-transparent text-success'
    : 'bg-success-strong text-white hover:bg-success-strong-hover'
}

export interface TabCounts {
  pending: number
  invites: number
}

/** Número vermelho da aba (0 = sem selo). */
export function tabBadge(tab: FriendsTab, counts: TabCounts): number {
  if (tab === 'pending') return counts.pending
  if (tab === 'invites') return counts.invites
  return 0
}
