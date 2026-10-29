// URLs do avatar e do banner. O backend guarda "/api/profile-media/<uuid>" e, como o hash do Discord,
// "a_<uuid>" quando é GIF animado. "/static" entrega o primeiro quadro (ou a própria imagem, se ela
// não anima). Portado de features/profile/lib/profileMedia.ts do desktop.
import { mediaSrc } from '../../../shared/lib/mediaUrl'

/** Prévia local (arquivo escolhido e ainda não salvo). */
const isLocal = (url: string): boolean => /^(blob:|data:|file:|content:)/.test(url)

export function isAnimatedMedia(url: string | null | undefined): boolean {
  if (!url || isLocal(url)) return false
  const last = url.split('?')[0].split('/').filter(Boolean).pop() ?? ''
  return last.startsWith('a_')
}

/**
 * Endereço para o <Image>. `animate: false` pede o quadro parado de um GIF; imagem que não anima
 * (ou prévia local) volta como está.
 */
export function profileMediaSrc(
  url: string | null | undefined,
  { animate = true }: { animate?: boolean } = {}
): string | null {
  if (!url) return null
  if (isLocal(url)) return url
  const path = !animate && isAnimatedMedia(url) ? `${url}/static` : url
  return mediaSrc(path)
}
