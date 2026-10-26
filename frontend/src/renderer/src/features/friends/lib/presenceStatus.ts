import type { NotificationPrefs } from '../../notifications/lib/notifications'

// Status como no Discord. A pessoa escolhe online/ausente/não perturbe/
// invisível; "offline" é o que os outros veem quando ela está desconectada
// ou invisível.

export type ChosenStatus = 'online' | 'idle' | 'dnd' | 'invisible'
export type PresenceStatus = ChosenStatus | 'offline'

export const CHOSEN_STATUSES: ChosenStatus[] = ['online', 'idle', 'dnd', 'invisible']

/**
 * Cores pelos tokens do tema (assets/theme.css): `color` é a bolinha (verde/
 * amarelo/vermelho do Discord); `textColor`, a versão legível (AA) para texto.
 */
export const STATUS_META: Record<
  PresenceStatus,
  { label: string; color: string; textColor: string; description?: string }
> = {
  online: { label: 'Online', color: 'var(--green)', textColor: 'var(--text-positive)' },
  idle: { label: 'Ausente', color: 'var(--yellow)', textColor: 'var(--text-warning)' },
  dnd: {
    label: 'Não perturbe',
    color: 'var(--red)',
    textColor: 'var(--text-danger)',
    description: 'Você não receberá notificações na área de trabalho'
  },
  invisible: {
    label: 'Invisível',
    color: 'var(--text-faint)',
    textColor: 'var(--text-muted)',
    description: 'Você aparecerá offline, mas terá acesso total ao Salinha'
  },
  offline: { label: 'Offline', color: 'var(--text-faint)', textColor: 'var(--text-muted)' }
}

export function isChosenStatus(value: unknown): value is ChosenStatus {
  return typeof value === 'string' && (CHOSEN_STATUSES as string[]).includes(value)
}

/**
 * Status de um evento/resposta de presença. O backend manda "status"; sem ele
 * (backend antigo) vale o "online" de antes.
 */
export function presenceStatusOf(status: unknown, online: boolean): PresenceStatus {
  if (status === 'offline' || isChosenStatus(status)) return status
  return online ? 'online' : 'offline'
}

/** Preferências valendo agora: "Não perturbe" silencia toasts, barra e som. */
export function prefsForStatus(
  prefs: NotificationPrefs,
  status: ChosenStatus | undefined
): NotificationPrefs {
  if (status !== 'dnd') return prefs
  return { desktop: false, taskbar: false, sound: false }
}
