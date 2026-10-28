// URLs do avatar e do banner. O backend guarda "/api/profile-media/<uuid>" e,
// como o hash do Discord, "a_<uuid>" quando é GIF animado. "/static" entrega o
// primeiro quadro (ou a própria imagem, se ela não anima).

/** Prévia local (arquivo escolhido e ainda não salvo). */
const isLocal = (url: string): boolean => /^(blob:|data:)/.test(url)

export function isAnimatedMedia(url: string | null | undefined): boolean {
  if (!url || isLocal(url)) return false
  const last = url.split('?')[0].split('/').filter(Boolean).pop() ?? ''
  return last.startsWith('a_')
}

/**
 * Endereço para o <img>. `animate: false` pede o quadro parado de um GIF;
 * imagem que não anima (ou prévia local) volta como está. `apiBase` é o
 * API_BASE_URL: "http://host/api" no desktop, "/api" no navegador (mesma
 * origem). A URL salva já começa com /api.
 */
export function profileMediaSrc(
  url: string | null | undefined,
  apiBase: string,
  { animate = true }: { animate?: boolean } = {}
): string | null {
  if (!url) return null
  if (isLocal(url) || /^https?:\/\//.test(url)) return url
  const path = !animate && isAnimatedMedia(url) ? `${url}/static` : url
  const origin = /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : ''
  return `${origin}${path}`
}

/** Banner sem imagem nem cor escolhida (o cartão do próprio perfil, fora de servidor). */
export const DEFAULT_BANNER = 'linear-gradient(135deg, #5865f2, #8b5cf6)'
