import type { NameStyle } from './nameStyle'
import type { ProfileTheme } from './profileTheme'

/**
 * O que o cartão mostra, igual para o próprio usuário (/users/me) e para os outros
 * (/users/:id/profile). O servidor manda estilo e tema do jeito que foram salvos: quem desenha passa
 * por resolveNameStyle e resolveProfileTheme antes de usar.
 */
export interface ProfileAppearance {
  avatar_url?: string | null
  banner_url?: string | null
  banner_color?: string | null
  pronouns?: string
  bio?: string
  status_text?: string
  /** O backend manda cada link como { url }. */
  links?: { url: string }[]
  name_style?: Partial<NameStyle> | null
  profile_theme?: Partial<ProfileTheme> | null
}

export interface ProfileData extends ProfileAppearance {
  id: string
  username: string
  display_name: string
  is_bot?: boolean
}
