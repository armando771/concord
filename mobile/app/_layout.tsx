import { registerGlobals } from '@livekit/react-native'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useCallEvents } from '../src/features/call/hooks/useCallEvents'
import { useCallLifecycle } from '../src/features/call/hooks/useCallLifecycle'
import { useCallPresence } from '../src/features/call/hooks/useCallPresence'
import { useIncomingCallRoute } from '../src/features/call/hooks/useIncomingCallRoute'
import { useCurrentUser } from '../src/features/auth/hooks/useCurrentUser'
import { useUnreadLive } from '../src/features/chat/hooks/useUnreadLive'
import { useNotificationTap } from '../src/features/notifications/hooks/useNotificationTap'
import { usePushRegistration } from '../src/features/notifications/hooks/usePushRegistration'
import { useResetOnSignOut } from '../src/features/servers/hooks/useResetOnSignOut'
import { useNetworkWatcher, useRealtimeSession } from '../src/features/auth/hooks/useRealtimeSession'
import { bindAuthSession } from '../src/features/auth/lib/bindAuthSession'
import { useAuthStore } from '../src/features/auth/store/authStore'
import { colors } from '../src/shared/theme/tokens'
import { ErrorBoundary } from '../src/shared/ui/ErrorBoundary'

void SplashScreen.preventAutoHideAsync()
// WebRTC do LiveKit: precisa rodar uma vez, antes de qualquer chamada (ADR 0023).
registerGlobals()
bindAuthSession()

function Gate() {
  const status = useAuthStore((s) => s.status)
  useRealtimeSession()
  useNetworkWatcher()
  useCurrentUser()
  useResetOnSignOut()
  useUnreadLive()
  usePushRegistration()
  useNotificationTap()
  useCallEvents()
  useCallPresence()
  useCallLifecycle()
  useIncomingCallRoute()

  useEffect(() => {
    void useAuthStore.getState().restore()
  }, [])

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync()
  }, [status])

  // Splash visível até a sessão ser restaurada: nenhuma tela decide sozinha se há login.
  if (status === 'loading') return null

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgApp } }}>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ErrorBoundary>
          <Gate />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
