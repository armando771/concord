import { API_BASE_URL } from '../../../shared/lib/config'
import { profileMediaSrc } from '../../profile/lib/profileMedia'

/**
 * Endereço do ícone do servidor para o <img>. Ícone enviado (/api/profile-media/…)
 * ganha a origem da API e GIF anima; ícone antigo guardado como URL externa
 * (https://…) ou prévia local segue como está.
 */
export function serverIconSrc(url: string | null | undefined): string | undefined {
  return profileMediaSrc(url, API_BASE_URL) ?? undefined
}
