import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { colors, MIN_TOUCH } from '../../../src/shared/theme/tokens'

type IconName = keyof typeof Ionicons.glyphMap

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />
  }

// Abas do Discord: Início (servidores e canais), Mensagens (DMs e amigos),
// Notificações e Você (perfil e configurações).
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // O padrão do React Navigation é o tema claro: sem isso as abas sem fundo próprio ficam brancas.
        sceneStyle: { backgroundColor: colors.bgPrimary },
        tabBarActiveTintColor: colors.textStrong,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bgSecondary, borderTopColor: colors.borderSubtle, minHeight: MIN_TOUCH + 12 }
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="mensagens" options={{ title: 'Mensagens', tabBarIcon: icon('chatbubble-ellipses') }} />
      <Tabs.Screen name="notificacoes" options={{ title: 'Notificações', tabBarIcon: icon('notifications') }} />
      <Tabs.Screen name="voce" options={{ title: 'Você', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  )
}
