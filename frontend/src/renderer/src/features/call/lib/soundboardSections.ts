/**
 * Como a mesa de áudio de uma chamada se monta: os favoritos da pessoa (de
 * qualquer servidor) e os sons do servidor da chamada que não são favoritos.
 */
interface NamedSound {
  id: string
  name: string
}

export interface SoundboardSections<S, F> {
  favorites: F[]
  server: S[]
}

export function soundboardSections<S extends NamedSound, F extends NamedSound>(
  serverSounds: S[],
  favorites: F[],
  query: string
): SoundboardSections<S, F> {
  const q = query.trim().toLowerCase()
  const matches = (s: NamedSound): boolean => !q || s.name.toLowerCase().includes(q)
  const favoriteIds = new Set(favorites.map((f) => f.id))
  return {
    favorites: favorites.filter(matches),
    server: serverSounds.filter((s) => !favoriteIds.has(s.id) && matches(s))
  }
}

/** O som cujo atalho de teclado é este (sem diferenciar maiúsculas). */
export function findSoundForShortcut<S extends { id: string }>(
  shortcut: string,
  keybinds: Record<string, string>,
  sounds: S[]
): S | undefined {
  const wanted = shortcut.toLowerCase()
  return sounds.find((s) => keybinds[s.id]?.toLowerCase() === wanted)
}
