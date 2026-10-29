// As visitas de quem tem conta: cada acesso de visitante ativo vira um item no
// trilho de servidores e abre em /visitas/<servidor> (só a call do convite).
// Um acesso por servidor (o do convite mais novo vale). Puro.

/** O mínimo de um acesso que as funções daqui usam. */
interface VisitLike {
  server_id: string
  expires_at: string
}

const VISIT_PREFIX = '/visitas/'

export function visitPath(serverId: string): string {
  return `${VISIT_PREFIX}${serverId}`
}

/** O servidor da visita aberta no caminho (ou null fora de /visitas/). */
export function visitServerOf(path: string): string | null {
  const match = /^\/visitas\/([^/]+)/.exec(path)
  return match ? match[1] : null
}

/** Novo acesso ou o mesmo com o canal trocado (mover): substitui o do servidor. */
export function upsertVisit<T extends VisitLike>(list: T[], pass: T): T[] {
  const at = list.findIndex((v) => v.server_id === pass.server_id)
  if (at < 0) return [...list, pass]
  return list.map((v, i) => (i === at ? pass : v))
}

export function removeVisit<T extends VisitLike>(list: T[], serverId: string): T[] {
  return list.filter((v) => v.server_id !== serverId)
}

/** As que ainda valem (o servidor encerra as vencidas a cada 30 s). */
export function liveVisits<T extends VisitLike>(list: T[], now: number): T[] {
  return list.filter((v) => Date.parse(v.expires_at) > now)
}

export function visitOf<T extends VisitLike>(
  list: T[],
  serverId: string | undefined,
  now: number
): T | null {
  if (!serverId) return null
  return liveVisits(list, now).find((v) => v.server_id === serverId) ?? null
}
