import { request } from '../../../shared/api/client'
import type { Message } from './messages'

/** Onde buscar: todos os canais de texto visíveis do servidor, ou uma DM/grupo. */
export type SearchScope = { kind: 'server'; id: string } | { kind: 'conversation'; id: string }

export interface SearchResult extends Message {
  /** Nome do canal (resultados de servidor). */
  channel_name?: string | null
}

export interface SearchPage {
  results: SearchResult[]
  total: number
  /** A contagem parou no teto (mostra "1000+"). */
  total_capped: boolean
  offset: number
  limit: number
}

export function searchMessages(scope: SearchScope, params: URLSearchParams): Promise<SearchPage> {
  const base = scope.kind === 'server' ? `/servers/${scope.id}` : `/conversations/${scope.id}`
  return request<SearchPage>(`${base}/messages/search?${params.toString()}`)
}
