import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Channel } from '../api/channels'

const reorderChannels = vi.fn()
vi.mock('../api/channels', () => ({
  listChannels: vi.fn(),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
  reorderChannels: (...args: unknown[]) => reorderChannels(...args)
}))
vi.mock('../api/servers', () => ({}))
vi.mock('../api/invites', () => ({}))
vi.mock('./authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: 't' }) }
}))

const { useServerStore } = await import('./serverStore')

const ch = (id: string, type: 'text' | 'voice'): Channel => ({
  id,
  type,
  server_id: 's1',
  name: id,
  created_by: 'u',
  created_at: '',
  updated_at: ''
})

const ids = (type: string): string[] =>
  useServerStore
    .getState()
    .channels.filter((c) => c.type === type)
    .map((c) => c.id)

beforeEach(() => {
  reorderChannels.mockReset()
  useServerStore.setState({
    currentServer: { id: 's1' } as never,
    channels: [ch('t1', 'text'), ch('v1', 'voice'), ch('t2', 'text'), ch('v2', 'voice')]
  })
})

describe('serverStore.reorderChannels', () => {
  it('muda a ordem na hora, antes da resposta', async () => {
    let resolve: () => void = () => {}
    reorderChannels.mockReturnValue(new Promise<void>((r) => (resolve = r)))
    const done = useServerStore.getState().reorderChannels('s1', 'text', ['t2', 't1'])
    expect(ids('text')).toEqual(['t2', 't1'])
    expect(ids('voice')).toEqual(['v1', 'v2'])
    resolve()
    await done
    expect(reorderChannels).toHaveBeenCalledWith('s1', 'text', ['t2', 't1'])
    expect(ids('text')).toEqual(['t2', 't1'])
  })

  it('servidor recusou: volta a ordem de antes e repassa o erro', async () => {
    reorderChannels.mockRejectedValue(new Error('sem permissão'))
    await expect(
      useServerStore.getState().reorderChannels('s1', 'voice', ['v2', 'v1'])
    ).rejects.toThrow('sem permissão')
    expect(ids('voice')).toEqual(['v1', 'v2'])
  })
})

describe('serverStore.applyChannelOrder (WS)', () => {
  it('aplica a ordem de outro moderador no servidor aberto', () => {
    useServerStore.getState().applyChannelOrder('s1', 'voice', ['v2', 'v1'])
    expect(ids('voice')).toEqual(['v2', 'v1'])
  })

  it('ignora evento de outro servidor', () => {
    useServerStore.getState().applyChannelOrder('s2', 'voice', ['v2', 'v1'])
    expect(ids('voice')).toEqual(['v1', 'v2'])
  })
})
