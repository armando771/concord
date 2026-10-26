import { request } from '../../../shared/api/client'

export type ChangelogKind = 'feature' | 'fix'

export interface ChangelogEntry {
  kind: ChangelogKind
  text: string
}

/** Uma versão do app e o que ela trouxe (backend: internal/changelog). */
export interface ChangelogRelease {
  version: string
  released_at: string
  summary: string
  entries: ChangelogEntry[]
}

/** Da release mais nova para a mais antiga. */
export function fetchChangelog(): Promise<ChangelogRelease[]> {
  return request<ChangelogRelease[]>('/changelog')
}
