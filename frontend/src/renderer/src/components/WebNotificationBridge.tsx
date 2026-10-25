import { useEffect } from 'react'
import router from '../router'
import { setWebNotifier } from '../lib/notifications'
import { titleWithUnread, webNotificationAction } from '../lib/webNotifications'
import { browserPermission } from '../lib/browserNotifications'

const BASE_TITLE = 'Salinha'
const ICON = '/apple-touch-icon.png'

/**
 * Build web: faz o papel do processo main nas notificações. Aviso do
 * navegador (clique foca a aba e abre a conversa) e, no lugar do selo da barra
 * de tarefas, as não lidas no título da aba — "(3) Salinha" — até voltar a ela.
 */
function WebNotificationBridge(): null {
  useEffect(() => {
    let unread = 0
    const render = (): void => {
      document.title = titleWithUnread(BASE_TITLE, unread)
    }
    const seen = (): void => {
      if (document.visibilityState !== 'visible' || !document.hasFocus() || unread === 0) return
      unread = 0
      render()
    }

    setWebNotifier((payload) => {
      const page = { visible: document.visibilityState === 'visible', focused: document.hasFocus() }
      const action = webNotificationAction(payload, browserPermission(), page)
      if (action.show) {
        try {
          const notification = new Notification(payload.title, {
            body: payload.body,
            icon: ICON,
            // Chamada fica na tela até a pessoa atender ou fechar.
            requireInteraction: payload.urgent === true
          })
          notification.onclick = () => {
            window.focus()
            void router.navigate(payload.route)
            notification.close()
          }
        } catch {
          // Navegador que só notifica via service worker (ex.: Chrome no Android).
        }
      }
      if (action.countUnread) {
        unread++
        render()
      }
    })

    window.addEventListener('focus', seen)
    document.addEventListener('visibilitychange', seen)
    return () => {
      setWebNotifier(null)
      window.removeEventListener('focus', seen)
      document.removeEventListener('visibilitychange', seen)
      document.title = BASE_TITLE
    }
  }, [])

  return null
}

export default WebNotificationBridge
