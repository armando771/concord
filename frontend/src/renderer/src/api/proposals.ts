import { request } from './client'

export type ProposalStatus = 'voting' | 'proposed' | 'in_progress' | 'done' | 'rejected'

export interface Proposal {
  id: string
  author_id: string
  author_name: string
  author_avatar_url?: string | null
  title: string
  description: string
  status: ProposalStatus
  created_at: string
  voting_ends_at: string
  closed_at?: string | null
  github_issue_number?: number | null
  github_issue_url?: string | null
  yes_votes: number
  no_votes: number
  /** true = sim, false = não, ausente = não votou. */
  my_vote?: boolean | null
}

export interface ProposalBoard {
  proposals: Proposal[]
  /** Time tech: pode mover os cards depois da votação. */
  is_tech: boolean
}

export function listProposals(): Promise<ProposalBoard> {
  return request<ProposalBoard>('/proposals')
}

export function createProposal(title: string, description: string): Promise<Proposal> {
  return request<Proposal>('/proposals', {
    method: 'POST',
    body: JSON.stringify({ title, description })
  })
}

export function voteProposal(id: string, approve: boolean): Promise<Proposal> {
  return request<Proposal>(`/proposals/${id}/vote`, {
    method: 'PUT',
    body: JSON.stringify({ approve })
  })
}

export function removeProposalVote(id: string): Promise<Proposal> {
  return request<Proposal>(`/proposals/${id}/vote`, { method: 'DELETE' })
}

export function setProposalStatus(id: string, status: ProposalStatus): Promise<Proposal> {
  return request<Proposal>(`/proposals/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
}

export function deleteProposal(id: string): Promise<void> {
  return request<void>(`/proposals/${id}`, { method: 'DELETE' })
}
