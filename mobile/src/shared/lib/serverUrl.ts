// Endereços do servidor a partir de uma URL base (porte enxuto do desktop:
// frontend/.../shared/lib/serverUrl.ts, sem LiveKit nem CSP).

export const DEFAULT_SERVER_URL = 'http://localhost:8080'

export interface ServerUrls {
  apiBaseUrl: string
  wsUrl: string
  /** A sala de mídia fica na mesma origem do servidor (o backend repassa ao LiveKit). */
  liveKitUrl: string
}

export function deriveServerUrls(serverUrl: string | undefined): ServerUrls {
  const url = new URL(serverUrl?.trim() || DEFAULT_SERVER_URL)
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return {
    apiBaseUrl: `${url.origin}/api`,
    wsUrl: `${wsProtocol}//${url.host}/ws`,
    liveKitUrl: `${wsProtocol}//${url.host}`
  }
}
