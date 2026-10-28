import { Stack } from 'expo-router'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../src/shared/theme/tokens'
import { OfflineBanner } from '../../src/shared/ui/OfflineBanner'

// Coluna única como o app web/desktop (ADR 0007): a lista é a tela principal e o canal abre por cima.
export default function AppLayout() {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgPrimary } }} />
    </View>
  )
}
