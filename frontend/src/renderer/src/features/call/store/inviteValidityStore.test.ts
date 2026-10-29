import { afterEach, describe, expect, it, vi } from 'vitest'
import { useInviteValidityStore } from './inviteValidityStore'

vi.mock('../api/callInvites', () => ({ fetchInviteValid: vi.fn() }))
import { fetchInviteValid } from '../api/callInvites'

const INVITEE = { callId: 'c1', messageId: 'm1', role: 'invitee' as const }

afterEach(() => {
  useInviteValidityStore.setState({ byKey: {} })
  vi.mocked(fetchInviteValid).mockReset()
})

describe('inviteValidityStore', () => {
  it('pergunta ao servidor como convidado ou como convidador', async () => {
    vi.mocked(fetchInviteValid).mockResolvedValue(true)
    await useInviteValidityStore.getState().ensure(INVITEE)
    await useInviteValidityStore.getState().ensure({ ...INVITEE, messageId: 'm2', role: 'inviter' })
    expect(fetchInviteValid).toHaveBeenNthCalledWith(1, 'c1', 'invitee')
    expect(fetchInviteValid).toHaveBeenNthCalledWith(2, 'c1', 'inviter')
  })

  it('guarda a resposta: convite usável = valid, usado/acabado = invalid', async () => {
    vi.mocked(fetchInviteValid).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    await useInviteValidityStore.getState().ensure(INVITEE)
    await useInviteValidityStore.getState().ensure({ ...INVITEE, messageId: 'm2' })
    const { byKey } = useInviteValidityStore.getState()
    expect(Object.values(byKey)).toEqual(['valid', 'invalid'])
  })

  it('o mesmo cartão faz uma pergunta só (e uma vez)', async () => {
    vi.mocked(fetchInviteValid).mockResolvedValue(true)
    const { ensure } = useInviteValidityStore.getState()
    await Promise.all([ensure(INVITEE), ensure(INVITEE)])
    await ensure(INVITEE)
    expect(fetchInviteValid).toHaveBeenCalledTimes(1)
  })

  it('falha de rede não derruba o cartão: segue válido', async () => {
    vi.mocked(fetchInviteValid).mockRejectedValue(new Error('offline'))
    await useInviteValidityStore.getState().ensure(INVITEE)
    expect(Object.values(useInviteValidityStore.getState().byKey)).toEqual(['valid'])
  })

  it('markInvalid (call:invite_ended) vence a resposta que ainda estava a caminho', async () => {
    let resolve: (v: boolean) => void = () => {}
    vi.mocked(fetchInviteValid).mockReturnValue(new Promise((r) => (resolve = r)))
    const p = useInviteValidityStore.getState().ensure(INVITEE)
    useInviteValidityStore.getState().markInvalid('c1', 'invitee')
    resolve(true)
    await p
    expect(Object.values(useInviteValidityStore.getState().byKey)).toEqual(['invalid'])
  })

  it('convite usado só derruba os cartões de convidado; o do convidador segue', async () => {
    vi.mocked(fetchInviteValid).mockResolvedValue(true)
    const { ensure } = useInviteValidityStore.getState()
    await ensure(INVITEE)
    await ensure({ callId: 'c1', messageId: 'm2', role: 'inviter' })
    useInviteValidityStore.getState().markInvalid('c1', 'invitee')
    const { byKey } = useInviteValidityStore.getState()
    expect(Object.values(byKey).sort()).toEqual(['invalid', 'valid'])
  })

  it('call acabada (sem papel) derruba todos os cartões da call', async () => {
    vi.mocked(fetchInviteValid).mockResolvedValue(true)
    const { ensure } = useInviteValidityStore.getState()
    await ensure(INVITEE)
    await ensure({ callId: 'c1', messageId: 'm2', role: 'inviter' })
    useInviteValidityStore.getState().markInvalid('c1')
    expect(Object.values(useInviteValidityStore.getState().byKey)).toEqual(['invalid', 'invalid'])
  })

  it('convite novo (outra mensagem) pergunta de novo, mesmo depois de um uso', async () => {
    vi.mocked(fetchInviteValid).mockResolvedValue(true)
    const { ensure } = useInviteValidityStore.getState()
    await ensure(INVITEE)
    useInviteValidityStore.getState().markInvalid('c1', 'invitee')
    await ensure({ ...INVITEE, messageId: 'm9' })
    expect(useInviteValidityStore.getState().byKey['c1:invitee:m9']).toBe('valid')
  })
})
