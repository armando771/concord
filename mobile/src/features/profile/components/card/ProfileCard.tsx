import { StyleSheet, View } from 'react-native'
import { radius, spacing } from '../../../../shared/theme/tokens'
import type { PresenceStatus } from '../../../friends/lib/presenceStatus'
import { cardLook } from '../../lib/cardLook'
import type { ProfileData } from '../../lib/profileTypes'
import { CardAvatar } from './CardAvatar'
import { CardBanner } from './CardBanner'
import { CardBio } from './CardBio'
import { CardLinks, openExternal } from './CardLinks'
import { CardNames } from './CardNames'
import { CardSection } from './CardSection'

/** Largura máxima do cartão: em tela larga fica centrado em vez de esticar. */
const MAX_CARD_WIDTH = 480

interface ProfileCardProps {
  profile: ProfileData
  /** Status ao vivo para a bolinha; sem ele, sem bolinha. */
  status?: PresenceStatus
  onOpenLink?: (url: string) => void
}

/** O cartão do perfil como os outros o veem (sem os efeitos animados, que chegam com o Skia). */
export function ProfileCard({ profile, status, onOpenLink = openExternal }: ProfileCardProps) {
  const look = cardLook(profile.profile_theme)
  const bio = profile.bio?.trim() ?? ''
  const links = profile.links ?? []
  return (
    <View
      testID="profile-card"
      style={[styles.card, { backgroundColor: look.backgroundColor, borderColor: look.borderColor, borderWidth: look.borderWidth }]}
    >
      <CardBanner url={profile.banner_url} color={profile.banner_color} />
      <View style={styles.avatar}>
        <CardAvatar name={profile.display_name} uri={profile.avatar_url} status={status} cutout={look.backgroundColor} />
      </View>
      <View style={styles.body}>
        <CardNames
          displayName={profile.display_name}
          username={profile.username}
          nameStyle={profile.name_style}
          pronouns={profile.pronouns}
          statusText={profile.status_text}
          look={look}
        />
        {bio ? (
          <CardSection title="Sobre mim" look={look}>
            <CardBio text={bio} look={look} onOpen={onOpenLink} />
          </CardSection>
        ) : null}
        {links.length > 0 ? (
          <CardSection title="Links" look={look}>
            <CardLinks links={links} look={look} onOpen={onOpenLink} />
          </CardSection>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: MAX_CARD_WIDTH, alignSelf: 'center', borderRadius: radius.lg, overflow: 'hidden' },
  avatar: { marginTop: -44, paddingHorizontal: spacing.lg },
  body: { gap: spacing.lg, padding: spacing.lg }
})
