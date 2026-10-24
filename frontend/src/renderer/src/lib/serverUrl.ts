// Funções puras sobre o endereço do servidor. Usadas pelo renderer (config.ts)
// e pelo build (electron.vite.config.ts, para gerar a CSP) — sem import.meta.

export const DEFAULT_SERVER_URL = 'http://localhost:8080'

export interface ServerUrls {
  apiBaseUrl: string
  wsUrl: string
  /** O livekit-client acrescenta /rtc sozinho; o backend repassa para o LiveKit. */
  liveKitUrl: string
}

function normalize(serverUrl: string | undefined): URL {
  return new URL(serverUrl?.trim() || DEFAULT_SERVER_URL)
}

function toWsOrigin(url: URL): string {
  return `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
}

export function deriveServerUrls(serverUrl: string | undefined): ServerUrls {
  const url = normalize(serverUrl)
  const wsOrigin = toWsOrigin(url)
  return {
    apiBaseUrl: `${url.origin}/api`,
    wsUrl: `${wsOrigin}/ws`,
    liveKitUrl: wsOrigin
  }
}

/** Valor do `connect-src` da CSP para o servidor configurado. */
export function buildConnectSrc(serverUrl: string | undefined): string {
  const url = normalize(serverUrl)
  return `'self' ${url.origin} ${toWsOrigin(url)}`
}
