import type { User } from '../../../auth/store/authStore'
import ProfileCardBody from '../../../profile/components/ProfileCardBody'
import ProfileCardFrame from '../../../profile/components/ProfileCardFrame'
import { linkError, normalizeLink } from '../../../profile/lib/profileLinks'
import { profileThemeLook, resolveProfileTheme } from '../../../profile/lib/profileTheme'
import type { ProfileDraft } from '../../../profile/lib/profileValidation'
import type { CardSpot } from '../../../profile/lib/cardSpots'
import { DEFAULT_BANNER } from './ProfileMediaFields'

/** O que a prévia precisa além do rascunho: a conta e as imagens já resolvidas. */
export interface PreviewBase {
  user: User
  avatarUrl: string | null
  bannerUrl: string | null
}

/**
 * O cartão de perfil como os outros vão ver (o mesmo ProfileCardBody), com o
 * rascunho por cima do salvo. Com `onEdit`, cada parte abre o editor dela.
 */
export default function ProfilePreview({
  user,
  draft,
  avatarUrl,
  bannerUrl,
  onEdit
}: {
  user: User
  draft: ProfileDraft
  avatarUrl: string | null
  bannerUrl: string | null
  onEdit?: (spot: CardSpot) => void
}): React.JSX.Element {
  const theme = resolveProfileTheme(draft.profile_theme)
  const look = profileThemeLook(theme)
  return (
    <ProfileCardFrame
      look={look}
      effect={theme.effect}
      className="text-sm text-gray-200 shadow-2xl"
    >
      <ProfileCardBody
        preview
        isMe
        surface={look.surface}
        onEdit={onEdit}
        profile={{
          display_name: draft.display_name.trim() || user.username,
          name_style: draft.name_style,
          username: user.username,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
          banner_color: draft.banner_color,
          pronouns: draft.pronouns.trim(),
          bio: draft.bio,
          status_text: draft.status_text,
          // Na prévia só entram os links válidos.
          links: draft.links.map(normalizeLink).filter((l) => !linkError(l))
        }}
        status={user.status ?? 'online'}
        fallbackBanner={DEFAULT_BANNER}
      />
    </ProfileCardFrame>
  )
}
