import { beforeEach, describe, expect, it, vi } from 'vitest'

// Quadro de propostas: o skeleton é só da primeira carga, e um quadro que
// chegou vazio não volta ao skeleton a cada releitura.

const listProposals = vi.fn()
vi.mock('../api/proposals', () => ({
  listProposals: (...a: unknown[]) => listProposals(...a)
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: 't', user: { id: 'eu' } }) }
}))
vi.mock('../../../shared/store/toastStore', () => ({ showToast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))

const { useProposalStore } = await import('./proposalStore')

beforeEach(() => {
  listProposals.mockReset()
  useProposalStore.getState().reset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('proposalStore.loaded', () => {
  it('primeira carga: carregando até a resposta, depois loaded', async () => {
    listProposals.mockResolvedValue({ proposals: [], is_tech: false })
    const p = useProposalStore.getState().fetchProposals()
    expect(useProposalStore.getState().loading).toBe(true)
    await p
    expect(useProposalStore.getState().loading).toBe(false)
    expect(useProposalStore.getState().loaded).toBe(true)
  })

  it('quadro vazio de verdade: reler não mostra o skeleton de novo', async () => {
    listProposals.mockResolvedValue({ proposals: [], is_tech: false })
    await useProposalStore.getState().fetchProposals()
    const seen: boolean[] = []
    const stop = useProposalStore.subscribe((s) => seen.push(s.loading))
    await useProposalStore.getState().fetchProposals()
    stop()
    expect(seen.some(Boolean)).toBe(false)
  })

  it('reset (sair da conta) volta à primeira carga', async () => {
    listProposals.mockResolvedValue({ proposals: [], is_tech: false })
    await useProposalStore.getState().fetchProposals()
    useProposalStore.getState().reset()
    expect(useProposalStore.getState().loaded).toBe(false)
  })
})
