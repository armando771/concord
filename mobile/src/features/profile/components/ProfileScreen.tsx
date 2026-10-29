import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { colors, spacing } from '../../../shared/theme/tokens'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { IconButton } from '../../../shared/ui/IconButton'
import { useCardPresence } from '../hooks/useCardPresence'
import { useProfileCard } from '../hooks/useProfileCard'
import { ProfileCard } from './card/ProfileCard'

interface ProfileScreenProps {
  userId: string
  onBack: () => void
  onOpenLink?: (url: string) => void
}

/** Cartão de uma pessoa em tela cheia: carregando, erro (com tentar de novo) ou o cartão. */
export function ProfileScreen({ userId, onBack, onOpenLink }: ProfileScreenProps) {
  const { profile, status, reload } = useProfileCard(userId)
  const presence = useCardPresence(userId)
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" label="Voltar" onPress={onBack} />
      </View>
      {profile ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <ProfileCard profile={profile} status={presence} onOpenLink={onOpenLink} />
        </ScrollView>
      ) : status === 'error' ? (
        <View style={styles.center}>
          <Banner message="Não foi possível abrir esse perfil." />
          <Button title="Tentar de novo" variant="secondary" onPress={reload} />
        </View>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator testID="profile-loading" color={colors.brand} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingHorizontal: spacing.sm },
  scroll: { padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }
})
