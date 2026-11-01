import { create } from 'zustand'
import {
  addFavoriteSound,
  listFavoriteSounds,
  removeFavoriteSound,
  type FavoriteSoundItem
} from '../api/soundFavorites'
import { clearLegacyFavorites, legacyFavoriteIds } from '../lib/legacySoundFavorites'

/**
 * Sons favoritos da pessoa (a estrela na mesa de áudio). Ficam no servidor e
 * valem nas chamadas de qualquer servidor, não só no de origem.
 */
interface SoundFavoritesState {
  favorites: FavoriteSoundItem[]
  loaded: boolean
  load: () => Promise<void>
  /** Liga ou desliga a estrela; erro (som apagado, limite) sobe para quem chamou. */
  toggle: (soundId: string) => Promise<void>
  /** O som foi apagado na origem. */
  forget: (soundId: string) => void
}

/** Envia os favoritos antigos do localStorage; o que falhar (som apagado) fica para trás. */
async function migrateLegacy(): Promise<void> {
  const ids = legacyFavoriteIds()
  for (const id of ids) {
    await addFavoriteSound(id).catch(() => undefined)
  }
  clearLegacyFavorites()
}

export const useSoundFavoritesStore = create<SoundFavoritesState>()((set, get) => ({
  favorites: [],
  loaded: false,

  load: async () => {
    await migrateLegacy()
    const favorites = await listFavoriteSounds().catch(() => null)
    if (favorites) set({ favorites, loaded: true })
  },

  toggle: async (soundId) => {
    const isFavorite = get().favorites.some((f) => f.id === soundId)
    const favorites = isFavorite
      ? await removeFavoriteSound(soundId)
      : await addFavoriteSound(soundId)
    set({ favorites })
  },

  forget: (soundId) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== soundId) }))
}))
