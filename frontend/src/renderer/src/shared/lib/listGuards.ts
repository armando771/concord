// Listas que vêm do servidor: um item fora do formato (null, sem id) não pode
// derrubar a tela. Um servidor mais novo ou mais velho que o app já mandou
// linhas que o app não esperava (DM em grupo sem other_user, na 0.6.12).

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Itens que são objeto com `key` texto não vazio; o resto some (com aviso no console). */
export function keepWithId<T>(raw: unknown, key: string, label: string): T[] {
  if (!Array.isArray(raw)) return []
  const out = raw.filter((item) => isRecord(item) && typeof item[key] === 'string' && item[key])
  if (out.length !== raw.length) {
    console.warn(`[${label}] ${raw.length - out.length} item(ns) fora do formato ignorado(s)`)
  }
  return out as T[]
}
