import { Stack } from 'expo-router'
import { colors } from '../../src/shared/theme/tokens'

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgApp } }} />
}
