import { create } from 'zustand'
import type { Proposal, ProposalStatus } from '../api/proposals'
import {
  createProposal,
  deleteProposal,
  listProposals,
  removeProposalVote,
  setProposalStatus,
  voteProposal
} from '../api/proposals'
import type { WsEvent } from '../api/ws'
import { mergeProposal } from '../lib/proposals'
import { useAuthStore } from './authStore'

interface ProposalState {
  proposals: Proposal[]
  isTech: boolean
  loading: boolean
  fetchProposals: () => Promise<void>
  create: (title: string, description: string) => Promise<void>
  vote: (id: string, approve: boolean) => Promise<void>
  removeVote: (id: string) => Promise<void>
  setStatus: (id: string, status: ProposalStatus) => Promise<void>
  remove: (id: string) => Promise<void>
  handleWsEvent: (event: WsEvent) => void
  reset: () => void
}

const isSameSession = (tokenAtStart: string | null): boolean =>
  useAuthStore.getState().accessToken === tokenAtStart

export const useProposalStore = create<ProposalState>()((set, get) => {
  /** Troca o card pela resposta da API (traz o meu voto). */
  const apply = (p: Proposal): void => set({ proposals: mergeProposal(get().proposals, p) })

  return {
    proposals: [],
    isTech: false,
    loading: false,
    fetchProposals: async () => {
      const token = useAuthStore.getState().accessToken
      if (get().proposals.length === 0) set({ loading: true })
      try {
        const board = await listProposals()
        if (!isSameSession(token)) return
        set({
          proposals: Array.isArray(board.proposals) ? board.proposals : [],
          isTech: !!board.is_tech
        })
      } catch (err) {
        console.error('[proposalStore] fetchProposals error:', err)
      } finally {
        if (get().loading) set({ loading: false })
      }
    },
    create: async (title, description) => apply(await createProposal(title, description)),
    vote: async (id, approve) => apply(await voteProposal(id, approve)),
    removeVote: async (id) => {
      const p = await removeProposalVote(id)
      // A resposta já vem sem o meu voto: força o nulo no merge.
      set({ proposals: get().proposals.map((x) => (x.id === id ? { ...p, my_vote: null } : x)) })
    },
    setStatus: async (id, status) => apply(await setProposalStatus(id, status)),
    remove: async (id) => {
      await deleteProposal(id)
      set({ proposals: get().proposals.filter((p) => p.id !== id) })
    },
    handleWsEvent: (event) => {
      if (event.type === 'proposal:delete') {
        const id = (event.payload as { id?: string })?.id
        if (id) set({ proposals: get().proposals.filter((p) => p.id !== id) })
        return
      }
      if (event.type === 'proposal:create' || event.type === 'proposal:update') {
        const p = event.payload as Proposal
        if (p?.id) apply(p)
      }
    },
    reset: () => set({ proposals: [], isTech: false, loading: false })
  }
})
