import type { WebPermission } from './webNotifications'

// Acesso à Notification API do navegador (build web), sem quebrar onde ela
// não existe.

export function browserPermission(): WebPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/** Pede a permissão (precisa vir de um clique). Devolve o resultado. */
export async function requestBrowserPermission(): Promise<WebPermission> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return browserPermission()
  }
}
