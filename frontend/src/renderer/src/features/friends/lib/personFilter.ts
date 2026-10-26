export interface Nameable {
  username: string
  display_name?: string
}

/** A pessoa bate com o texto da busca (nome de usuário ou de exibição)? */
export function matchesPerson(u: Nameable, text: string): boolean {
  const q = text.trim().toLowerCase()
  if (!q) return true
  return u.username.toLowerCase().includes(q) || (u.display_name ?? '').toLowerCase().includes(q)
}

export function filterPeople<T extends Nameable>(list: T[], text: string): T[] {
  return list.filter((u) => matchesPerson(u, text))
}
