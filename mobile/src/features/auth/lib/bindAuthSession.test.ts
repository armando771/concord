import { session } from '../../../shared/api/session'
import { useAuthStore } from '../store/authStore'
import { bindAuthSession } from './bindAuthSession'

jest.mock('./secureTokens')

describe('bindAuthSession', () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState(), true)
    bindAuthSession()
  })

  it('a porta lê os tokens do authStore', () => {
    useAuthStore.setState({ accessToken: 'a', refreshToken: 'r' })
    expect(session().tokens()).toEqual({ accessToken: 'a', refreshToken: 'r' })
  })

  it('setTokens grava no authStore', async () => {
    await session().setTokens({ accessToken: 'a2', refreshToken: 'r2' })
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'a2', refreshToken: 'r2' })
  })

  it('expire sai da conta com o aviso', async () => {
    useAuthStore.setState({ status: 'signedIn', accessToken: 'a', refreshToken: 'r' })
    await session().expire()
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', notice: 'Sua sessão expirou' })
  })
})
