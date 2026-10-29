import * as api from '../api/friends'
import type { Friend, PendingRequest } from '../api/friends'
import { useFriendsStore } from './friendsStore'

jest.mock('../api/friends')

const m = jest.mocked(api)
const state = () => useFriendsStore.getState()
const friend = (id: string): Friend => ({ id, username: id, display_name: id })
const req = (id: string): PendingRequest => ({
  user_id: id,
  username: id,
  display_name: id,
  direction: 'incoming',
  created_at: ''
})

describe('friendsStore', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    useFriendsStore.setState(useFriendsStore.getInitialState(), true)
    m.listFriends.mockResolvedValue([friend('a')])
    m.listPending.mockResolvedValue([req('p')])
    m.listBlocked.mockResolvedValue([friend('b')])
  })

  it('load busca as três listas', async () => {
    await state().load()
    expect(state().friends.map((f) => f.id)).toEqual(['a'])
    expect(state().pending.map((p) => p.user_id)).toEqual(['p'])
    expect(state().blocked.map((f) => f.id)).toEqual(['b'])
    expect(state().status).toBe('ready')
  })

  it('falha numa lista não apaga as outras e marca erro', async () => {
    await state().load()
    m.listFriends.mockResolvedValue([friend('a'), friend('c')])
    m.listPending.mockRejectedValue(new Error('x'))
    await state().load()
    expect(state().friends).toHaveLength(2)
    expect(state().pending).toHaveLength(1)
    expect(state().status).toBe('error')
  })

  it('cada ação chama a API certa e recarrega as listas', async () => {
    m.acceptFriendRequest.mockResolvedValue({ message: '' })
    m.declineFriendRequest.mockResolvedValue({ message: '' })
    m.cancelFriendRequest.mockResolvedValue({ message: '' })
    m.removeFriend.mockResolvedValue({ message: '' })
    m.blockUser.mockResolvedValue({ message: '' })
    m.unblockUser.mockResolvedValue({ message: '' })
    expect(await state().accept('p')).toBe('ok')
    expect(m.acceptFriendRequest).toHaveBeenCalledWith('p')
    expect(await state().decline('p')).toBe('ok')
    expect(m.declineFriendRequest).toHaveBeenCalledWith('p')
    expect(await state().cancel('p')).toBe('ok')
    expect(m.cancelFriendRequest).toHaveBeenCalledWith('p')
    expect(await state().remove('a')).toBe('ok')
    expect(m.removeFriend).toHaveBeenCalledWith('a')
    expect(await state().block('u1')).toBe('ok')
    expect(m.blockUser).toHaveBeenCalledWith('u1')
    expect(await state().unblock('u1')).toBe('ok')
    expect(m.unblockUser).toHaveBeenCalledWith('u1')
    expect(m.listFriends).toHaveBeenCalledTimes(6)
  })

  it('ação que falha devolve "error" e mantém as listas', async () => {
    await state().load()
    m.removeFriend.mockRejectedValue(new Error('x'))
    expect(await state().remove('a')).toBe('error')
    expect(state().friends).toHaveLength(1)
  })

  it('send devolve o resultado do servidor e recarrega; falha devolve o erro', async () => {
    m.sendFriendRequest.mockResolvedValue({ message: '', result: 'sent' })
    expect(await state().send('ana')).toEqual({ kind: 'ok', result: 'sent' })
    expect(m.sendFriendRequest).toHaveBeenCalledWith('ana')
    const err = Object.assign(new Error('x'), { status: 404, code: 'user_not_found' })
    m.sendFriendRequest.mockRejectedValue(err)
    expect(await state().send('zzz')).toEqual({ kind: 'error', error: err })
  })

  it('reset limpa tudo', async () => {
    await state().load()
    state().reset()
    expect(state()).toMatchObject({ friends: [], pending: [], blocked: [], status: 'idle' })
  })
})
