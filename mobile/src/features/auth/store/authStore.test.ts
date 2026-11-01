import { clearTokens, loadTokens, saveTokens } from '../lib/secureTokens'
import { useAuthStore } from './authStore'

jest.mock('../lib/secureTokens')

const mocked = { load: jest.mocked(loadTokens), save: jest.mocked(saveTokens), clear: jest.mocked(clearTokens) }

const reset = () => useAuthStore.setState(useAuthStore.getInitialState(), true)

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    reset()
  })

  it('começa carregando, sem sessão', () => {
    expect(useAuthStore.getState()).toMatchObject({ status: 'loading', accessToken: null, user: null })
  })

  it('restore com tokens salvos: entra como logado', async () => {
    mocked.load.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' })
    await useAuthStore.getState().restore()
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'a', refreshToken: 'r' })
  })

  it('restore sem tokens: deslogado', async () => {
    mocked.load.mockResolvedValue({ accessToken: null, refreshToken: null })
    await useAuthStore.getState().restore()
    expect(useAuthStore.getState().status).toBe('signedOut')
  })

  it('restore com só um dos tokens: deslogado', async () => {
    mocked.load.mockResolvedValue({ accessToken: 'a', refreshToken: null })
    await useAuthStore.getState().restore()
    expect(useAuthStore.getState().status).toBe('signedOut')
  })

  it('signIn guarda os tokens no Keystore e limpa o aviso', async () => {
    useAuthStore.setState({ notice: 'Sua sessão expirou' })
    await useAuthStore.getState().signIn({ accessToken: 'a', refreshToken: 'r' })
    expect(mocked.save).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' })
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', notice: null })
  })

  it('setTokens (renovação) troca os tokens e persiste', async () => {
    await useAuthStore.getState().signIn({ accessToken: 'a', refreshToken: 'r' })
    await useAuthStore.getState().setTokens({ accessToken: 'a2', refreshToken: 'r2' })
    expect(mocked.save).toHaveBeenLastCalledWith({ accessToken: 'a2', refreshToken: 'r2' })
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'a2', refreshToken: 'r2' })
  })

  it('signOut limpa tokens e usuário', async () => {
    await useAuthStore.getState().signIn({ accessToken: 'a', refreshToken: 'r' })
    await useAuthStore.getState().signOut()
    expect(mocked.clear).toHaveBeenCalled()
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', accessToken: null, user: null, notice: null })
  })

  it('expire: sai da conta com o aviso "Sua sessão expirou"', async () => {
    await useAuthStore.getState().signIn({ accessToken: 'a', refreshToken: 'r' })
    await useAuthStore.getState().expire()
    expect(mocked.clear).toHaveBeenCalled()
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', notice: 'Sua sessão expirou' })
  })
})
