import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Linking } from 'react-native'
import { CallScreen } from '../../src/features/call/components/CallScreen'
import { callController } from '../../src/features/call/lib/callRuntime'
import { useCallSessionStore } from '../../src/features/call/store/callSessionStore'

export default function CallRoute() {
  const router = useRouter()
  const idle = useCallSessionStore((s) => s.phase === 'idle')

  // A chamada acabou (ou nunca existiu): não deixa uma tela vazia aberta.
  useEffect(() => {
    if (idle) router.back()
  }, [idle, router])

  return (
    <CallScreen
      onBack={() => router.back()}
      onLeave={() => void callController.leave()}
      onOpenSettings={() => void Linking.openSettings()}
    />
  )
}
