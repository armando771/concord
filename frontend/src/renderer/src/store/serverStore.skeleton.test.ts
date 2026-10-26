import { beforeEach, describe, expect, it, vi } from 'vitest'

// O skeleton só aparece na primeira carga: depois os dados antigos ficam na
// tela e a releitura troca por baixo. `serversLoaded` e `channelsLoadedFor`
// dizem se a primeira resposta já chegou.

const listServers = vi.fn()
const apiListChannels = vi.fn()
vi.mock('../api/servers', () => ({
  listServers: (...args: unknown[]) => listServers(...args),
  getServer: vi.fn()
}))
vi.mock('../api/channels', () => ({
  listChannels: (...args: unknown[]) => apiListChannels(...args)
}))
vi.mock('../api/roles', () => ({}))
vi.mock('../api/invites', () => ({}))
vi.mock('./authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: 't' }) }
}))

const { useServerStore } = await import('./serverStore')

beforeEach(() => {
  listServers.mockReset()
  apiListChannels.mockReset()
  useServerStore.getState().reset()
})

describe('serversLoaded', () => {
  it('começa falso e vira verdadeiro quando a lista chega', async () => {
    expect(useServerStore.getState().serversLoaded).toBe(false)
    listServers.mockResolvedValue([{ id: 's1', name: 'S1', owner_id: 'ana' }])
    await useServerStore.getState().fetchServers()
    expect(useServerStore.getState().serversLoaded).toBe(true)
    expect(useServerStore.getState().servers).toHaveLength(1)
  })

  it('lista vazia de verdade também conta como carregada (sem skeleton eterno)', async () => {
    listServers.mockResolvedValue([])
    await useServerStore.getState().fetchServers()
    expect(useServerStore.getState().serversLoaded).toBe(true)
  })

  it('falha na rede também encerra o skeleton', async () => {
    listServers.mockRejectedValue(new Error('rede fora'))
    await useServerStore.getState().fetchServers()
    expect(useServerStore.getState().serversLoaded).toBe(true)
  })

  it('reler não volta ao skeleton', async () => {
    listServers.mockResolvedValue([{ id: 's1', name: 'S1', owner_id: 'ana' }])
    await useServerStore.getState().fetchServers()
    const seen: boolean[] = []
    const stop = useServerStore.subscribe((s) => seen.push(s.serversLoaded))
    await useServerStore.getState().fetchServers()
    stop()
    expect(seen.every(Boolean)).toBe(true)
  })

  it('sair da conta (reset) volta a primeira carga', async () => {
    listServers.mockResolvedValue([])
    await useServerStore.getState().fetchServers()
    useServerStore.getState().reset()
    expect(useServerStore.getState().serversLoaded).toBe(false)
  })
})

describe('channelsLoadedFor', () => {
  it('marca de qual servidor são os canais que chegaram', async () => {
    apiListChannels.mockResolvedValue([])
    expect(useServerStore.getState().channelsLoadedFor).toBeNull()
    await useServerStore.getState().fetchChannels('s1')
    expect(useServerStore.getState().channelsLoadedFor).toBe('s1')
  })

  it('trocar de servidor: os canais do anterior não valem para o novo', async () => {
    apiListChannels.mockResolvedValue([])
    await useServerStore.getState().fetchChannels('s1')
    expect(useServerStore.getState().channelsLoadedFor).not.toBe('s2')
  })

  it('falha ao buscar os canais encerra o skeleton daquele servidor', async () => {
    apiListChannels.mockRejectedValue(new Error('rede fora'))
    await useServerStore.getState().fetchChannels('s1')
    expect(useServerStore.getState().channelsLoadedFor).toBe('s1')
  })

  it('fechar o servidor (clearCurrentServer) esquece, para o próximo abrir com skeleton', async () => {
    apiListChannels.mockResolvedValue([])
    await useServerStore.getState().fetchChannels('s1')
    useServerStore.getState().clearCurrentServer()
    expect(useServerStore.getState().channelsLoadedFor).toBeNull()
  })
})
