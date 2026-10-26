import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerInvite } from '../api/invites'

// A lista de convites é relida a cada foco da janela: com convites na tela, a
// releitura não pode trocá-los pelo "Carregando convites...".

const listInvites = vi.fn()
vi.mock('../api/invites', () => ({
  listInvites: (...args: unknown[]) => listInvites(...args),
  acceptInvite: vi.fn(),
  declineInvite: vi.fn()
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: 't' }) }
}))
vi.mock('./serverStore', () => ({ useServerStore: { getState: () => ({}) } }))

const { useInviteStore } = await import('./inviteStore')

const invite = (id: string): ServerInvite => ({
  id,
  server_id: 's1',
  inviter_id: 'ana',
  invitee_id: 'bia'
})

beforeEach(() => {
  listInvites.mockReset()
  useInviteStore.setState({ invites: [], loading: false, loaded: false })
})

describe('fetchInvites', () => {
  it('primeira carga (lista vazia) mostra o carregando', async () => {
    listInvites.mockResolvedValue([invite('i1')])
    const p = useInviteStore.getState().fetchInvites()
    expect(useInviteStore.getState().loading).toBe(true)
    await p
    expect(useInviteStore.getState().loading).toBe(false)
    expect(useInviteStore.getState().invites).toHaveLength(1)
  })

  it('releitura com convites na tela: não fica carregando nem esvazia', async () => {
    useInviteStore.setState({ invites: [invite('i1')] })
    listInvites.mockResolvedValue([invite('i1'), invite('i2')])
    const seen: Array<{ loading: boolean; count: number }> = []
    const stop = useInviteStore.subscribe((s) =>
      seen.push({ loading: s.loading, count: s.invites.length })
    )
    await useInviteStore.getState().fetchInvites()
    stop()
    expect(seen.some((s) => s.loading)).toBe(false)
    expect(seen.some((s) => s.count === 0)).toBe(false)
    expect(useInviteStore.getState().invites.map((i) => i.id)).toEqual(['i1', 'i2'])
  })

  it('falha na releitura mantém os convites que já estavam na tela', async () => {
    useInviteStore.setState({ invites: [invite('i1')] })
    listInvites.mockRejectedValue(new Error('rede fora'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await useInviteStore.getState().fetchInvites()
    expect(useInviteStore.getState().invites).toHaveLength(1)
    expect(useInviteStore.getState().loading).toBe(false)
  })
})

describe('loaded (skeleton só na primeira carga)', () => {
  it('lista que chegou vazia: reler não volta ao carregando', async () => {
    listInvites.mockResolvedValue([])
    await useInviteStore.getState().fetchInvites()
    expect(useInviteStore.getState().loaded).toBe(true)
    const seen: boolean[] = []
    const stop = useInviteStore.subscribe((s) => seen.push(s.loading))
    await useInviteStore.getState().fetchInvites()
    stop()
    expect(seen.some(Boolean)).toBe(false)
  })

  it('falha na primeira carga não marca como carregada (tenta de novo no foco)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    listInvites.mockRejectedValue(new Error('rede fora'))
    await useInviteStore.getState().fetchInvites()
    expect(useInviteStore.getState().loaded).toBe(false)
    expect(useInviteStore.getState().loading).toBe(false)
  })
})
