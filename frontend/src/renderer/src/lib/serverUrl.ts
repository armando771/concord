import { ACTIVITIES } from '../../../shared/activities'
// Funções puras sobre o endereço do servidor. Usadas pelo renderer (config.ts)
// e pelo build (electron.vite.config.ts, para gerar a CSP) — sem import.meta.

export const DEFAULT_SERVER_URL = 'http://localhost:8080'

export interface ServerUrls {
  apiBaseUrl: string
  wsUrl: string
  /**
   * O livekit-client acrescenta /rtc sozinho. Na VPS o Caddy manda /rtc direto
   * para o LiveKit; sem Caddy (PC de casa), o backend repassa.
   */
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

/**
 * Valor do `media-src` (e parte do `img-src`) da CSP: arquivos do chat vêm do
 * servidor e as prévias locais do campo de envio são URLs `blob:`.
 */
export function buildMediaSrc(serverUrl: string | undefined): string {
  return `'self' blob: ${normalize(serverUrl).origin}`
}

export interface ResolveOptions {
  /** Build web (navegador): o backend está na mesma origem da página. */
  web: boolean
  /** VITE_SERVER_URL do build desktop (ignorado no web). */
  serverUrl?: string
  /** location.origin da página (só usado no web). */
  pageOrigin?: string
}

/**
 * Endereços que o app usa. Desktop: o servidor embutido no build. Navegador:
 * a mesma origem da página — API relativa e WebSocket/LiveKit em ws(s) do
 * mesmo host (https → wss, sem conteúdo misto).
 */
export function resolveServerUrls({ web, serverUrl, pageOrigin }: ResolveOptions): ServerUrls {
  if (!web) return deriveServerUrls(serverUrl)
  const wsOrigin = toWsOrigin(normalize(pageOrigin))
  return {
    apiBaseUrl: '/api',
    wsUrl: `${wsOrigin}/ws`,
    liveKitUrl: wsOrigin
  }
}

/**
 * `connect-src` do build web. `'self'` já cobre o ws(s) da mesma origem nos
 * navegadores atuais; o wss do endereço público entra explícito para os que
 * ainda não tratam assim.
 */
export function buildWebConnectSrc(publicUrl: string | undefined): string {
  const url = publicUrl?.trim()
  return url ? `'self' ${toWsOrigin(new URL(url))}` : "'self'"
}

/** `media-src` do build web: arquivos do chat na própria origem e prévias `blob:`. */
export function buildWebMediaSrc(): string {
  return "'self' blob:"
}

/**
 * Diretivas que só o build web acrescenta à CSP (o desktop fica como está).
 * frame-src: só o iframe das atividades (os jogos do catálogo); o desktop abre o jogo
 * numa janela própria.
 */
export const WEB_EXTRA_CSP = `base-uri 'self'; frame-src ${ACTIVITIES.flatMap((a) => a.origins).join(' ')}`

/** Preenche os marcadores da CSP do index.html; `extra` vem depois do connect-src. */
export function fillCsp(
  html: string,
  { connectSrc, mediaSrc, extra }: { connectSrc: string; mediaSrc: string; extra?: string }
): string {
  return html
    .replace('%CONCORD_CONNECT_SRC%', extra ? `${connectSrc}; ${extra}` : connectSrc)
    .replaceAll('%CONCORD_MEDIA_SRC%', mediaSrc)
}
