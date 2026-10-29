import { request } from '../../../shared/api/client'
import type { ServerLevelDetail } from '../lib/serverLevel'

/** Nível do servidor com o XP de cada fonte nos últimos 7 dias (só membros). */
export function fetchServerLevel(serverId: string): Promise<ServerLevelDetail> {
  return request<ServerLevelDetail>(`/servers/${encodeURIComponent(serverId)}/level`)
}
