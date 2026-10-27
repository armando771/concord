import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCallInviteStore, sentKey } from './callInviteStore'

vi.mock('../api/callInvites', () => ({ sendCallInvites: vi.fn() }))
import { sendCallInvites } from '../api/callInvites'

const invite = (call_id: string, by = 'ana'): never =>
  ({ call_id, by: { id: by, username: by, display_name: by }, expires_at: 'x' }) as never

afterEach(() => {
  useCallInviteStore.setState({
    received: [],
    sentStatus: {},
    phase: 'idle',
    results: [],
    error: null
  })
  vi.mocked(sendCallInvites).mockReset()
})

describe('callInviteStore', () => {
  it('um cartão por call: o convite novo substitui o antigo', () => {
    const s = useCallInviteStore.getState()
    s.addReceived(invite('c1', 'ana'))
    s.addReceived(invite('c1', 'bia'))
    s.addReceived(invite('c2'))
    expect(useCallInviteStore.getState().received.map((r) => r.by.id)).toEqual(['bia', 'ana'])
  })

  it('removeReceived tira o cartão da call', () => {
    const s = useCallInviteStore.getState()
    s.addReceived(invite('c1'))
    s.removeReceived('c1')
    expect(useCallInviteStore.getState().received).toEqual([])
  })

  it('guarda como cada convidado respondeu', () => {
    useCallInviteStore.getState().markSent({ call_id: 'c1', user_id: 'bia', status: 'accepted' })
    expect(useCallInviteStore.getState().sentStatus[sentKey('c1', 'bia')]).toBe('accepted')
  })

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
