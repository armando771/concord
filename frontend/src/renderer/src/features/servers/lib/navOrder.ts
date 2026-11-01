/**
 * Próximo (dir = 1) ou anterior (dir = -1) item da lista, dando a volta no fim.
 * Com `isUnread`, pula quem não tem não lidas. Sem item atual na lista, começa
 * do início (ou do fim, para trás). Nada elegível: null.
 */
export function nextTarget(
  ids: string[],
  current: string | null,
  dir: 1 | -1,
  isUnread?: (id: string) => boolean
): string | null {
  const n = ids.length
  if (n === 0) return null
  const start = current === null ? -1 : ids.indexOf(current)
  for (let step = 1; step <= n; step++) {
    const idx =
      start === -1 ? (dir === 1 ? step - 1 : n - step) : (((start + dir * step) % n) + n) % n
    const id = ids[idx]
    if (id === current) continue
    if (!isUnread || isUnread(id)) return id
  }
  return null
}
