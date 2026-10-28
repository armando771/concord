import type { ProfileLink, User } from '../../auth/store/authStore'
import { NAME_CHARS_MESSAGE, nameCharsError } from '../../profile/lib/nameChars'
import type { NameStyle } from '../../profile/lib/nameStyle'
import type { ProfileTheme } from '../../profile/lib/profileTheme'
import { charCount, draftFromProfile } from '../../profile/lib/profileValidation'

// Perfis salvos (issue #344): o perfil inteiro guardado com um nome para
// trocar com um clique. Os limites são os do backend (internal/savedprofile).

export const MAX_SAVED_PROFILES = 10
export const MAX_SAVED_PROFILE_NAME = 32
/** O "busy" do store enquanto salva um perfil novo (o resto usa o id). */
export const SAVING_NEW = 'new'

/** Os campos do perfil como o backend guardou (user.ProfileInput). */
export interface SavedProfileFields {
  display_name: string
  pronouns?: string
  bio?: string
  status_text?: string
  banner_color?: string | null
  links?: ProfileLink[] | null
  name_style?: Partial<NameStyle> | null
  profile_theme?: Partial<ProfileTheme> | null
}

export interface SavedProfile {
  id: string
  name: string
  fields: SavedProfileFields
  avatar_url: string | null
  banner_url: string | null
  created_at: string
  updated_at: string
}

const sameName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/** Erro do nome (criar ou renomear), ou null. `ownId`: o que está sendo renomeado. */
export function savedProfileNameError(
  raw: string,
  list: SavedProfile[] = [],
  ownId?: string
): string | null {
  const name = raw.trim()
  if (charCount(name) < 1) return 'Dê um nome ao perfil.'
  if (charCount(name) > MAX_SAVED_PROFILE_NAME) return `Até ${MAX_SAVED_PROFILE_NAME} caracteres.`
  if (nameCharsError(name)) return NAME_CHARS_MESSAGE
  if (list.some((s) => s.id !== ownId && sameName(s.name, name))) {
    return 'Já existe um perfil com esse nome.'
  }
  return null
}

/** Uma chave do visual do perfil: igual quando tudo o que aparece é igual. */
function lookKey(
  fields: Parameters<typeof draftFromProfile>[0],
  avatar: string | null | undefined,
  banner: string | null | undefined
): string {
  const d = draftFromProfile(fields)
  const look = [d.display_name, d.pronouns, d.bio, d.status_text, d.banner_color, d.links]
  return JSON.stringify([...look, d.name_style, d.profile_theme, avatar ?? null, banner ?? null])
}

/** O perfil salvo igual ao perfil de agora (o "Em uso"), ou null. */
export function currentSavedProfileId(list: SavedProfile[], user: User | null): string | null {
  if (!user) return null
  const current = lookKey(user, user.avatar_url, user.banner_url)
  return list.find((s) => lookKey(s.fields, s.avatar_url, s.banner_url) === current)?.id ?? null
}

export const canSaveMore = (list: SavedProfile[]): boolean => list.length < MAX_SAVED_PROFILES

/** "Perfil N" com o menor N que ainda não existe. */
export function suggestSavedName(list: SavedProfile[]): string {
  for (let n = 1; ; n++) {
    const name = `Perfil ${n}`
    if (!list.some((s) => sameName(s.name, name))) return name
  }
}

/** Troca pelo id, ou acrescenta no fim se for novo. */
export function replaceSaved(list: SavedProfile[], item: SavedProfile): SavedProfile[] {
  return list.some((s) => s.id === item.id)
    ? list.map((s) => (s.id === item.id ? item : s))
    : [...list, item]
}

export const removeSaved = (list: SavedProfile[], id: string): SavedProfile[] =>
  list.filter((s) => s.id !== id)

/**
 * Texto do erro para o toast: as recusas do servidor (nome repetido, limite,
 * não encontrado) já vêm em português (com a inicial maiúscula aqui); o resto
 * vira o texto da tela.
 */
export function savedProfileError(err: unknown, fallback: string): string {
  const status = (err as { status?: unknown } | null)?.status
  if (typeof status === 'number' && status >= 400 && status < 500 && err instanceof Error) {
    return err.message.charAt(0).toUpperCase() + err.message.slice(1)
  }
  return fallback
}

/**
 * O que um toque num perfil salvo faz: nada (já em uso ou ocupado), aplicar
 * direto (o perfil de agora também está salvo) ou confirmar antes (o perfil
 * de agora não está salvo e se perderia).
 */
export function applyStep(
  id: string,
  currentId: string | null,
  busy: boolean
): 'skip' | 'apply' | 'confirm' {
  if (busy || id === currentId) return 'skip'
  return currentId === null ? 'confirm' : 'apply'
}

/** Envia o nome se der (sem erro e sem nada em andamento); true = gravou. */
export async function submitSavedName(
  name: string,
  error: string | null,
  busy: boolean,
  send: (name: string) => Promise<boolean>
): Promise<boolean> {
  if (error || busy) return false
  return send(name)
}
