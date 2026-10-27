import { afterEach, describe, expect, it, vi } from 'vitest'
import { useInviteValidityStore } from './inviteValidityStore'

vi.mock('../api/callInvites', () => ({ fetchInviteValid: vi.fn() }))
import { fetchInviteValid } from '../api/callInvites'

afterEach(() => {
  useInviteValidityStore.setState({ byCall: {} })
  vi.mocked(fetchInviteValid).mockReset()
})

describe('inviteValidityStore', () => {
  it('pergunta ao servidor e guarda: call viva = valid, acabada = invalid', async () => {
    vi.mocked(fetchInviteValid).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    await useInviteValidityStore.getState().ensure('c1')
    await useInviteValidityStore.getState().ensure('c2')
    expect(useInviteValidityStore.getState().byCall).toEqual({ c1: 'valid', c2: 'invalid' })
  })

  it('vários cartões da mesma call fazem uma pergunta só (e uma vez)', async () => {
    vi.mocked(fetchInviteValid).mockResolvedValue(true)
    const { ensure } = useInviteValidityStore.getState()
    await Promise.all([ensure('c1'), ensure('c1')])
    await ensure('c1')
    expect(fetchInviteValid).toHaveBeenCalledTimes(1)
  })

  it('falha de rede não derruba o cartão: segue válido', async () => {
    vi.mocked(fetchInviteValid).mockRejectedValue(new Error('offline'))
    await useInviteValidityStore.getState().ensure('c1')
    expect(useInviteValidityStore.getState().byCall.c1).toBe('valid')
  })

  it('markInvalid (call:invite_ended) vence a resposta que ainda estava a caminho', async () => {
    let resolve: (v: boolean) => void = () => {}
    vi.mocked(fetchInviteValid).mockReturnValue(new Promise((r) => (resolve = r)))
    const p = useInviteValidityStore.getState().ensure('c1')
    useInviteValidityStore.getState().markInvalid('c1')
    resolve(true)
    await p
    expect(useInviteValidityStore.getState().byCall.c1).toBe('invalid')
  })
})
