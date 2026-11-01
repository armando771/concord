/**
 * Favoritos antigos da mesa de áudio: até a migration 000126 ficavam só no
 * localStorage, junto das preferências (volume e atalhos). O app os envia ao
 * servidor uma vez e depois tira daqui.
 */
export const SOUNDBOARD_PREFS_KEY = 'concord:soundboard-prefs'

function readPrefs(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SOUNDBOARD_PREFS_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Ids favoritados no localStorage (vazio se não há ou já foram levados). */
export function legacyFavoriteIds(): string[] {
  const { favorites } = readPrefs()
  return Array.isArray(favorites) ? favorites.filter((x): x is string => typeof x === 'string') : []
}

/** Tira os favoritos antigos, mantendo as outras preferências. */
export function clearLegacyFavorites(): void {
  const prefs = readPrefs()
  if (!('favorites' in prefs)) return
  delete prefs.favorites
  try {
    localStorage.setItem(SOUNDBOARD_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage indisponível
  }
}
