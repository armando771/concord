import { renderRouter, screen } from 'expo-router/testing-library'
import { useAuthStore } from '../src/features/auth/store/authStore'

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(true)
}))
jest.mock('../src/features/auth/lib/secureTokens', () => ({
  loadTokens: jest.fn().mockResolvedValue({ accessToken: null, refreshToken: null }),
  saveTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined)
}))
jest.mock('@expo/vector-icons', () => ({ Ionicons: Object.assign(() => null, { glyphMap: {} }) }))
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()) }
}))

// Regressão: sem sessão o app abre em "/" e precisa cair no login, não em "Unmatched Route".
describe('rotas do app', () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState(), true)
  })

  it('sem sessão, "/" mostra o login', async () => {
    await renderRouter('./app', { initialUrl: '/' })
    expect(await screen.findByText('Boas-vindas de volta!')).toBeOnTheScreen()
    expect(screen.queryByText('Unmatched Route')).toBeNull()
  })

  it('com sessão, "/" mostra as abas', async () => {
    await renderRouter('./app', { initialUrl: '/' })
    useAuthStore.setState({ status: 'signedIn', accessToken: 'a', refreshToken: 'r' })
    expect(await screen.findByText('Em breve')).toBeOnTheScreen()
  })
})
