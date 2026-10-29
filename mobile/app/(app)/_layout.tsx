import { Stack } from 'expo-router'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../src/shared/theme/tokens'
import { OfflineBanner } from '../../src/shared/ui/OfflineBanner'

export default function AppLayout() {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp, paddingTop: insets.top }}>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgPrimary } }} />
    </View>
  )
}
