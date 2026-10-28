import { API_BASE_URL } from './config'

const ORIGIN = new URL(API_BASE_URL).origin

/** Endereço de imagem do servidor (avatar, ícone): caminho relativo ganha a origem da API. */
export function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https?:\/\//.test(url) ? url : `${ORIGIN}${url}`
}
