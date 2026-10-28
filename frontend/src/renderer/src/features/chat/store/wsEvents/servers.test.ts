import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatState } from '../chatStore'
import type { ChatWsContext } from './context'

const servers = vi.hoisted(() => ({
  servers: [{ id: 's1', name: 'Salinha' }],
  currentServer: { id: 's1' } as { id: string } | null,
  refreshServer: vi.fn(async () => {}),
  removeLocalServer: vi.fn(),
  updateMember: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn()
}))
const toast = vi.hoisted(() => ({ error: vi.fn() }))
const nav = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('../../../servers/store/serverStore', () => ({
  useServerStore: { getState: () => servers }
}))
vi.mock('../../../../shared/store/toastStore', () => ({ showToast: toast }))
vi.mock('../../../../app/router', () => ({ router: nav }))

const { SERVER_HANDLERS, handleRoleEvent, lostChannelRoom, reconcileAfterPermissionChange } =
  await import('./servers')

function fakeCtx(initial: Partial<ChatState>): { ctx: ChatWsContext; state: () => ChatState } {
  let state = {
    channelsByServer: {},
    activeRoom: null,
    closeRoom: vi.fn(),
    handleServerDeleted: vi.fn(),
    fetchChannelsForServers: vi.fn(async () => {}),
    ...initial
  } as unknown as ChatState
  const ctx = {
    set: (next) => {
      state = { ...state, ...next(state) }
    },
    get: () => state
  } as ChatWsContext
  return { ctx, state: () => state }
}

const send = (type: string, payload: Record<string, unknown>, ctx: ChatWsContext): void =>
  SERVER_HANDLERS[type](payload, ctx, { type, payload })

beforeEach(() => {
  vi.clearAllMocks()
  servers.currentServer = { id: 's1' }
})

describe('lostChannelRoom', () => {
  it('o canal aberto sumiu da lista: devolve a sala', () => {
    expect(lostChannelRoom('channel:c1', ['c1', 'c2'], ['c2'])).toBe('channel:c1')
  })

  it.each([
    ['nenhuma sala', null, ['c1'], []],
    ['DM aberta', 'conversation:d1', ['d1'], []],
    ['canal continua visível', 'channel:c1', ['c1'], ['c1']],
    ['canal nem estava na lista', 'channel:c9', ['c1'], []]
  ])('%s: null', (_, room, before, after) => {
    expect(lostChannelRoom(room, before, after)).toBeNull()
  })
})

describe('reconcileAfterPermissionChange', () => {
  it('perdeu o canal aberto: relê, fecha a sala e volta ao servidor', async () => {
    const { ctx, state } = fakeCtx({ activeRoom: 'channel:c1', channelsByServer: { s1: ['c1'] } })
    vi.mocked(state().fetchChannelsForServers).mockImplementation(async () => {
      ctx.set(() => ({ channelsByServer: { s1: [] } }))
    })
    await reconcileAfterPermissionChange('s1', ctx)
    expect(servers.refreshServer).toHaveBeenCalledWith('s1')
    expect(state().closeRoom).toHaveBeenCalledWith('channel:c1')
    expect(nav.navigate).toHaveBeenCalledWith('/servers/s1')
  })

  it('outro servidor aberto e canal mantido: só relê os canais', async () => {
    servers.currentServer = { id: 's2' }
    const { ctx, state } = fakeCtx({ activeRoom: 'channel:c1', channelsByServer: { s1: ['c1'] } })
    await reconcileAfterPermissionChange('s1', ctx)
    expect(servers.refreshServer).not.toHaveBeenCalled()
    expect(state().fetchChannelsForServers).toHaveBeenCalledWith(['s1'])
    expect(state().closeRoom).not.toHaveBeenCalled()
  })
})

describe('handleRoleEvent', () => {
  it('server:removed por expulsão: tira o servidor e avisa', () => {
    const { ctx, state } = fakeCtx({})
    const handled = handleRoleEvent(
      { type: 'server:removed', payload: { server_id: 's1', reason: 'kick' } },
      ctx
    )
    expect(handled).toBe(true)
    expect(state().handleServerDeleted).toHaveBeenCalledWith('s1')
    expect(servers.removeLocalServer).toHaveBeenCalledWith('s1')
    expect(toast.error).toHaveBeenCalledWith('Você foi expulso de “Salinha”.')
  })

  it('server:removed porque saiu: sem aviso', () => {
    const { ctx } = fakeCtx({})
    handleRoleEvent({ type: 'server:removed', payload: { server_id: 's1', reason: 'leave' } }, ctx)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('server:permissions:invalidate relê os canais', async () => {
    const { ctx, state } = fakeCtx({})
    handleRoleEvent({ type: 'server:permissions:invalidate', payload: { server_id: 's1' } }, ctx)
    await vi.waitFor(() => expect(state().fetchChannelsForServers).toHaveBeenCalledWith(['s1']))
  })

  it('evento de outro tipo: false', () => {
    const { ctx } = fakeCtx({})
    expect(handleRoleEvent({ type: 'message:create', payload: {} }, ctx)).toBe(false)
  })
})

describe('eventos de servidor e membros', () => {
  it('server:delete tira o servidor (sem id, nada)', () => {
    const { ctx, state } = fakeCtx({})
    send('server:delete', {}, ctx)
    send('server:delete', { server_id: 's1' }, ctx)
    expect(state().handleServerDeleted).toHaveBeenCalledTimes(1)
    expect(servers.removeLocalServer).toHaveBeenCalledWith('s1')
  })

  it('membros: atualiza, entra e sai (só com os dados completos)', () => {
    const { ctx } = fakeCtx({})
    const member = { user_id: 'u1' }
    send('server:member:update', { server_id: 's1', member }, ctx)
    send('server:member:join', { server_id: 's1', member }, ctx)
    send('server:member:leave', { server_id: 's1', user_id: 'u1' }, ctx)
    send('server:member:update', { server_id: 's1' }, ctx)
    send('server:member:join', { member }, ctx)
    send('server:member:leave', { server_id: 's1' }, ctx)
    expect(servers.updateMember).toHaveBeenCalledOnce()
    expect(servers.addMember).toHaveBeenCalledWith('s1', member)
    expect(servers.removeMember).toHaveBeenCalledWith('s1', 'u1')
    expect(servers.addMember).toHaveBeenCalledOnce()
    expect(servers.removeMember).toHaveBeenCalledOnce()
  })
})
