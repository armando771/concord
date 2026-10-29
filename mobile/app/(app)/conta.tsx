import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { AccountPanel } from '../../src/features/auth/components/AccountPanel'
import { colors } from '../../src/shared/theme/tokens'
import { IconButton } from '../../src/shared/ui/IconButton'

export default function AccountRoute() {
  const router = useRouter()
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <View style={{ paddingHorizontal: 8 }}>
        <IconButton icon="arrow-back" label="Voltar" onPress={() => router.back()} />
      </View>
      <AccountPanel />
    </View>
  )
}
