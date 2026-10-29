import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useAuthStore } from '../../auth/store/authStore'
import { getProfile } from '../api/users'
import type { ProfileData } from '../lib/profileTypes'
import { useProfileCardStore } from '../store/profileCardStore'
import { useProfileCard } from './useProfileCard'

jest.mock('expo-secure-store')
jest.mock('../api/users')

const getProfileMock = jest.mocked(getProfile)
const ME = { id: 'u1', username: 'eu', display_name: 'Eu', email: 'e@x.co', bio: 'oi' }
const ANA: ProfileData = { id: 'u2', username: 'ana', display_name: 'Ana' }

/** Resposta que o teste libera quando quiser (o `await renderHook` já descarrega promessas prontas). */
function pending(): { promise: Promise<ProfileData>; resolve: (p: ProfileData) => void } {
  let resolve: (p: ProfileData) => void = () => {}
  const promise = new Promise<ProfileData>((r) => (resolve = r))
  return { promise, resolve }
}

describe('useProfileCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState(useAuthStore.getInitialState(), true)
    useProfileCardStore.getState().reset()
  })

  it('o próprio usuário vem da sessão, sem buscar no servidor', async () => {
    useAuthStore.setState({ user: ME })
    const { result } = await renderHook(() => useProfileCard('u1'))
    expect(result.current.status).toBe('ready')
    expect(result.current.profile).toMatchObject({ id: 'u1', bio: 'oi' })
    expect(getProfileMock).not.toHaveBeenCalled()
  })

  it('outro usuário: carrega, guarda no cache e fica pronto', async () => {
    const reply = pending()
    getProfileMock.mockReturnValue(reply.promise)
    const { result } = await renderHook(() => useProfileCard('u2'))
    expect(result.current).toMatchObject({ status: 'loading', profile: null })
    await act(async () => reply.resolve(ANA))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.profile).toEqual(ANA)
    expect(getProfileMock).toHaveBeenCalledTimes(1)
    expect(getProfileMock).toHaveBeenCalledWith('u2')
    expect(useProfileCardStore.getState().cards.u2).toEqual(ANA)
  })

  it('com cartão em cache abre na hora e recarrega por baixo', async () => {
    useProfileCardStore.getState().put({ ...ANA, display_name: 'Ana (antigo)' })
    const reply = pending()
    getProfileMock.mockReturnValue(reply.promise)
    const { result } = await renderHook(() => useProfileCard('u2'))
    expect(result.current).toMatchObject({ status: 'ready', profile: { display_name: 'Ana (antigo)' } })
    await act(async () => reply.resolve(ANA))
    await waitFor(() => expect(result.current.profile?.display_name).toBe('Ana'))
  })

  it('sem cache e com erro (ex.: 404): status error', async () => {
    getProfileMock.mockRejectedValue(Object.assign(new Error('x'), { status: 404 }))
    const { result } = await renderHook(() => useProfileCard('u2'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.profile).toBeNull()
  })

  // Review Focus 5: rede cai ao abrir o cartão de outra pessoa.
  it('com cache e com erro de rede: continua mostrando o cartão em cache', async () => {
    useProfileCardStore.getState().put(ANA)
    getProfileMock.mockRejectedValue(new Error('rede'))
    const { result } = await renderHook(() => useProfileCard('u2'))
    await waitFor(() => expect(getProfileMock).toHaveBeenCalled())
    expect(result.current).toMatchObject({ status: 'ready', profile: ANA })
  })

  it('reload busca de novo depois de um erro', async () => {
    getProfileMock.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(ANA)
    const { result } = await renderHook(() => useProfileCard('u2'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    await act(async () => result.current.reload())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(getProfileMock).toHaveBeenCalledTimes(2)
  })

  // Achado da revisão: a resposta de um cartão que chega depois do logout não pode voltar ao cache.
  it('resposta que chega depois de sair da conta não entra no cache da próxima', async () => {
    const reply = pending()
    getProfileMock.mockReturnValue(reply.promise)
    await renderHook(() => useProfileCard('u2'))
    await act(async () => useProfileCardStore.getState().reset())
    await act(async () => reply.resolve(ANA))
    expect(useProfileCardStore.getState().cards).toEqual({})
  })

  it('trocar o id busca o outro cartão', async () => {
    getProfileMock.mockImplementation(async (id) => ({ id, username: id, display_name: id }))
    const { result, rerender } = await renderHook((props: { id: string }) => useProfileCard(props.id), { initialProps: { id: 'u2' } })
    await waitFor(() => expect(result.current.profile?.id).toBe('u2'))
    await rerender({ id: 'u3' })
    await waitFor(() => expect(result.current.profile?.id).toBe('u3'))
  })
})
