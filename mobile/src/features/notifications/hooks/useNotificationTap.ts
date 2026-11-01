import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { getActiveDmCall } from '../../call/api/calls'
import { handleCallInviteTap } from '../../call/lib/callInviteTap'
import { onNotificationTap, takeLaunchTap } from '../lib/expoPush'
import { routeForNotification } from '../lib/notificationRoute'

/** Toque na notificação abre a tela certa, inclusive quando foi ele que abriu o app. */
export function useNotificationTap(): void {
  const router = useRouter()
  const signedIn = useAuthStore((s) => s.status === 'signedIn')

  useEffect(() => {
    if (!signedIn) return
    const open = (data: Record<string, unknown> | undefined): void => {
      if (data?.type === 'call_invite') return void handleCallInviteTap(data, { getActiveDmCall })
      const route = routeForNotification(data)
      if (route) router.push(route as never)
    }
    void takeLaunchTap().then(open)
    return onNotificationTap(open)
  }, [signedIn, router])
}
