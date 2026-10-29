import { API_BASE_URL } from './config'

const ORIGIN = new URL(API_BASE_URL).origin

/** Arquivo local (prévia de uma foto escolhida e ainda não salva). */
const isLocalUri = (url: string): boolean => /^(blob:|data:|file:|content:)/.test(url)

/**
 * O backend guarda "/api/profile-media/<uuid>" e, como o hash do Discord, "a_<uuid>" quando é GIF
 * animado. "/static" entrega o primeiro quadro (ou a própria imagem, se ela não anima).
 */
export function isAnimatedMedia(url: string | null | undefined): boolean {
  if (!url || isLocalUri(url)) return false
  const last = url.split('?')[0].split('/').filter(Boolean).pop() ?? ''
  return last.startsWith('a_')
}

/**
 * Endereço de imagem do servidor (avatar, ícone): caminho relativo ganha a origem da API.
 * `animate: false` pede o quadro parado de um GIF animado (listas); imagem que não anima, endereço
 * completo e arquivo local voltam como estão.
 */
export function mediaSrc(url: string | null | undefined, { animate = true }: { animate?: boolean } = {}): string | null {
  if (!url) return null
  if (isLocalUri(url) || /^https?:\/\//.test(url)) return url
  const path = !animate && isAnimatedMedia(url) ? `${url}/static` : url
  return `${ORIGIN}${path}`
}
