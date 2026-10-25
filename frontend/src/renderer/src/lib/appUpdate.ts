// Versão nova do app: o backend avisa pelo WS (app:update) quando o manifesto
// muda, e o WS reconectar costuma ser um deploy. Nos dois casos o main checa
// na hora (com debounce, e nada se a checagem anterior não terminou). Na web
// não existe window.api.updates: ignora.

/** Evento do backend: manifesto de atualização mudou ({ file, version }). */
export const APP_UPDATE_EVENT = 'app:update'

export function requestUpdateCheck(): void {
  if (typeof window === 'undefined') return
  window.api?.updates?.checkNow()
}
