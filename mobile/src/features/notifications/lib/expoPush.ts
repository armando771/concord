import * as Notifications from 'expo-notifications'
import type { PushPlatform } from './pushRegistration'

export const MESSAGES_CHANNEL = 'mensagens'
/** Canal das chamadas de DM recebidas (o backend manda `channel_id: chamadas`). */
export const CALLS_CHANNEL = 'chamadas'

/** Com o app aberto a pessoa já vê a mensagem na tela: não mostra banner por cima. */
export function silenceForeground(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false })
  })
}

async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  return (await Notifications.requestPermissionsAsync()).granted
}

async function getToken(): Promise<string | null> {
  const token = await Notifications.getDevicePushTokenAsync()
  return typeof token.data === 'string' && token.data !== '' ? token.data : null
}

export const expoPlatform: PushPlatform = {
  async ensureChannel() {
    await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL, {
      name: 'Mensagens',
      importance: Notifications.AndroidImportance.HIGH
    })
    await Notifications.setNotificationChannelAsync(CALLS_CHANNEL, {
      name: 'Chamadas',
      importance: Notifications.AndroidImportance.HIGH
    })
  },
  requestPermission,
  getToken,
  onTokenChange(cb) {
    const sub = Notifications.addPushTokenListener((t) => {
      if (typeof t.data === 'string') cb(t.data)
    })
    return () => sub.remove()
  }
}

type Data = Record<string, unknown> | undefined

/** Toque na notificação com o app aberto ou em segundo plano. */
export function onNotificationTap(cb: (data: Data) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => cb(r.notification.request.content.data))
  return () => sub.remove()
}

/** Toque que abriu o app do zero (consumido uma vez, para não reabrir a tela a cada início). */
export async function takeLaunchTap(): Promise<Data> {
  const response = await Notifications.getLastNotificationResponseAsync()
  if (!response) return undefined
  await Notifications.clearLastNotificationResponseAsync()
  return response.notification.request.content.data
}
