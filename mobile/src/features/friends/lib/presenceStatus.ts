import { colors } from '../../../shared/theme/tokens'

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline'

const KNOWN: PresenceStatus[] = ['online', 'idle', 'dnd', 'offline']

/**
 * Status de um evento/resposta de presença. Backend antigo mandava só `online` (true/false); quem
 * está invisível aparece como offline para os outros.
 */
export function presenceStatusOf(status: unknown, online: unknown): PresenceStatus {
  if (typeof status === 'string' && (KNOWN as string[]).includes(status)) return status as PresenceStatus
  if (status === 'invisible') return 'offline'
  return status === true || (typeof status !== 'string' && online === true) ? 'online' : 'offline'
}

export const STATUS_LABEL: Record<PresenceStatus, string> = {
  online: 'Online',
  idle: 'Ausente',
  dnd: 'Não perturbe',
  offline: 'Offline'
}

export const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: colors.green,
  idle: colors.yellow,
  dnd: colors.red,
  offline: colors.interactiveMuted
}
