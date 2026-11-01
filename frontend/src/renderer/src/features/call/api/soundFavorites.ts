import { request } from '../../../shared/api/client'
import type { SoundboardItem } from './soundboard'

/** Som favorito: pode ser de outro servidor (server_name diz de qual). */
export interface FavoriteSoundItem extends SoundboardItem {
  server_name: string
}

const FAVORITES = '/users/me/soundboard-favorites'

export function listFavoriteSounds(): Promise<FavoriteSoundItem[]> {
  return request<FavoriteSoundItem[]>(FAVORITES)
}

/** Favorita e devolve a lista nova. */
export function addFavoriteSound(soundId: string): Promise<FavoriteSoundItem[]> {
  return request<FavoriteSoundItem[]>(`${FAVORITES}/${encodeURIComponent(soundId)}`, {
    method: 'PUT'
  })
}

/** Tira dos favoritos e devolve a lista nova. */
export function removeFavoriteSound(soundId: string): Promise<FavoriteSoundItem[]> {
  return request<FavoriteSoundItem[]>(`${FAVORITES}/${encodeURIComponent(soundId)}`, {
    method: 'DELETE'
  })
}
