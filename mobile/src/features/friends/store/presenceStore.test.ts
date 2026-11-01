import { fetchPresence } from '../api/presence'
import { presenceStatusOf } from '../lib/presenceStatus'
import { usePresenceStore } from './presenceStore'

jest.mock('../api/presence')

const fetchMock = jest.mocked(fetchPresence)
const state = () => usePresenceStore.getState()

describe('presenceStatusOf', () => {
  it('usa o status quando é conhecido', () => {
    expect(presenceStatusOf('idle', true)).toBe('idle')
    expect(presenceStatusOf('dnd', true)).toBe('dnd')
    expect(presenceStatusOf('online', true)).toBe('online')
    expect(presenceStatusOf('offline', false)).toBe('offline')
  })

  it('backend antigo (só true/false) ou status desconhecido: online/offline', () => {
    expect(presenceStatusOf(undefined, true)).toBe('online')
    expect(presenceStatusOf(undefined, false)).toBe('offline')
    expect(presenceStatusOf(true, undefined)).toBe('online')
    expect(presenceStatusOf('lixo', false)).toBe('offline')
  })

  it('invisível aparece como offline para os outros', () => {
    expect(presenceStatusOf('invisible', true)).toBe('offline')
  })
})

describe('presenceStore', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    usePresenceStore.setState(usePresenceStore.getInitialState(), true)
  })

  it('load guarda o status de cada id', async () => {
    fetchMock.mockResolvedValue({ u1: 'online', u2: 'dnd', u3: false })
    await state().load(['u1', 'u2', 'u3'])
    expect(state().statuses).toEqual({ u1: 'online', u2: 'dnd', u3: 'offline' })
  })

  it('load sem ids não chama a API', async () => {
    await state().load([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falha ao carregar não derruba nem apaga o que já tinha', async () => {
    state().apply({ user_id: 'u1', status: 'online' })
    fetchMock.mockRejectedValue(new Error('rede'))
    await state().load(['u1'])
    expect(state().statuses.u1).toBe('online')
  })

  it('apply (presence:update) troca o status de uma pessoa', () => {
    state().apply({ user_id: 'u1', status: 'idle' })
    expect(state().statuses.u1).toBe('idle')
    state().apply({ user_id: 'u1', online: false })
    expect(state().statuses.u1).toBe('offline')
  })

  it('evento sem user_id é ignorado', () => {
    state().apply({ status: 'online' })
    expect(state().statuses).toEqual({})
  })

  it('reset limpa tudo', () => {
    state().apply({ user_id: 'u1', status: 'online' })
    state().reset()
    expect(state().statuses).toEqual({})
  })
})
