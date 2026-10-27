import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCallInviteStore } from './callInviteStore'

vi.mock('../api/callInvites', () => ({ sendCallInvites: vi.fn() }))
import { sendCallInvites } from '../api/callInvites'

afterEach(() => {
  useCallInviteStore.setState({
    phase: 'idle',
    results: [],
    error: null
  })
  vi.mocked(sendCallInvites).mockReset()
})

describe('callInviteStore', () => {
  it('envio: carregando, depois ok com o resultado de cada pessoa', async () => {
    vi.mocked(sendCallInvites).mockResolvedValue([{ user_id: 'bia', status: 'sent' }])
    const p = useCallInviteStore.getState().send('c1', ['bia'])
    expect(useCallInviteStore.getState().phase).toBe('loading')
    await p
    expect(useCallInviteStore.getState().phase).toBe('ok')
    expect(useCallInviteStore.getState().results).toEqual([{ user_id: 'bia', status: 'sent' }])
  })

  it('envio com falha: estado de erro com a mensagem', async () => {
    vi.mocked(sendCallInvites).mockRejectedValue(new Error('deu ruim'))
    await useCallInviteStore.getState().send('c1', ['bia'])
    expect(useCallInviteStore.getState().phase).toBe('error')
    expect(useCallInviteStore.getState().error).toBe('deu ruim')
  })
})
