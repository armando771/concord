import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { IncomingCallScreen } from '../../src/features/call/components/IncomingCallScreen'
import { callController } from '../../src/features/call/lib/callRuntime'
import { useIncomingCallStore } from '../../src/features/call/store/incomingCallStore'

export default function IncomingCallRoute() {
  const router = useRouter()
  const ringing = useIncomingCallStore((s) => s.call !== null)

  // Quem ligou desistiu (ou outro aparelho atendeu): fecha a tela de atender.
  useEffect(() => {
    if (!ringing) router.back()
  }, [ringing, router])

  return (
    <IncomingCallScreen
      onAccept={() => {
        void callController.acceptIncoming()
        router.replace('/chamada')
      }}
      onDecline={() => callController.declineIncoming()}
    />
  )
}
