// O Android derruba o WebSocket quando o app vai para o segundo plano ou a rede
// some: ao voltar (AppState "active" ou rede de volta) reconecta na hora, sem
// esperar o backoff. As fontes entram por parâmetro para testar sem o RN.

interface Retryable {
  retryNow(): void
}

interface AppStateSource {
  addEventListener(type: 'change', handler: (state: string) => void): { remove(): void }
}

interface NetInfoSource {
  addEventListener(handler: (state: { isConnected: boolean | null }) => void): () => void
}

/** Liga a reconexão ao ciclo de vida do app. Devolve o "desligar". */
export function bindRealtimeLifecycle(
  client: Retryable,
  appState: AppStateSource,
  netInfo: NetInfoSource
): () => void {
  const app = appState.addEventListener('change', (state) => {
    if (state === 'active') client.retryNow()
  })
  const net = netInfo.addEventListener((state) => {
    if (state.isConnected === true) client.retryNow()
  })
  return () => {
    app.remove()
    net()
  }
}
