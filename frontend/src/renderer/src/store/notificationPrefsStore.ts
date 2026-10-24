import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../lib/notifications'

interface NotificationPrefsState extends NotificationPrefs {
  setPref: (key: keyof NotificationPrefs, value: boolean) => void
}

/** Preferências de notificação (Configurações → Notificações), salvas no app. */
export const useNotificationPrefsStore = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_NOTIFICATION_PREFS,
      setPref: (key, value) => set({ [key]: value })
    }),
    { name: 'concord-notification-prefs' }
  )
)

/** Só os valores, para passar às funções puras de notificação. */
export function notificationPrefs(): NotificationPrefs {
  const { desktop, taskbar, sound } = useNotificationPrefsStore.getState()
  return { desktop, taskbar, sound }
}
