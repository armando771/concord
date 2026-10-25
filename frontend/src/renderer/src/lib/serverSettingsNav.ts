import { Perm } from './permissions'

// Seções das configurações do servidor (tela cheia, como as de usuário). Cada
// uma aparece para quem tem ao menos uma das permissões que ela usa.

export type ServerSettingsSectionId = 'overview' | 'roles' | 'members' | 'bans'

export interface ServerSettingsSection {
  id: ServerSettingsSectionId
  label: string
  /** Aparece para quem tem qualquer uma dessas permissões. */
  anyOf: number
}

export const SERVER_SETTINGS_SECTIONS: ServerSettingsSection[] = [
  { id: 'overview', label: 'Visão geral', anyOf: Perm.MANAGE_SERVER },
  { id: 'roles', label: 'Cargos', anyOf: Perm.MANAGE_ROLES },
  {
    id: 'members',
    label: 'Membros',
    anyOf: Perm.MANAGE_ROLES | Perm.KICK_MEMBERS | Perm.BAN_MEMBERS
  },
  { id: 'bans', label: 'Banimentos', anyOf: Perm.BAN_MEMBERS }
]

/** As seções que essas permissões deixam abrir. */
export function visibleServerSections(perms: number): ServerSettingsSection[] {
  return SERVER_SETTINGS_SECTIONS.filter((s) => (perms & s.anyOf) !== 0)
}

/** A seção pedida se ela é visível; senão a primeira que for (ou null). */
export function resolveServerSection(
  perms: number,
  wanted: ServerSettingsSectionId
): ServerSettingsSectionId | null {
  const visible = visibleServerSections(perms)
  if (visible.some((s) => s.id === wanted)) return wanted
  return visible[0]?.id ?? null
}

/** Alguma configuração do servidor está ao alcance (mostra o item no menu). */
export function canOpenServerSettings(perms: number): boolean {
  return visibleServerSections(perms).length > 0
}
