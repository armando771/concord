import { renderRouter, screen } from 'expo-router/testing-library'
import { loadTokens } from '../src/features/auth/lib/secureTokens'
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
jest.mock('expo-secure-store')
jest.mock('../src/features/servers/api/servers', () => ({ listServers: jest.fn().mockResolvedValue([]) }))
jest.mock('../src/features/servers/api/channels', () => ({ listChannels: jest.fn().mockResolvedValue([]) }))
jest.mock('../src/features/chat/api/messages', () => ({
  ...jest.requireActual('../src/features/chat/api/messages'),
  listChannelMessages: jest.fn().mockResolvedValue([]),
  sendChannelMessage: jest.fn()
}))
jest.mock('../src/features/auth/api/auth', () => ({
  ...jest.requireActual('../src/features/auth/api/auth'),
  getMe: jest.fn().mockResolvedValue({ id: 'u1', username: 'ana', display_name: 'Ana', email: 'a@b.co' })
}))
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()) }
}))

const signIn = () => useAuthStore.setState({ status: 'signedIn', accessToken: 'a', refreshToken: 'r' })

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

  it('com sessão, "/" mostra o trilho de servidores, a lista e o painel do usuário (sem abas)', async () => {
    await renderRouter('./app', { initialUrl: '/' })
    signIn()
    expect(await screen.findByRole('button', { name: 'Mensagens diretas' })).toBeOnTheScreen()
    expect(screen.getByText('Mensagens diretas: em breve')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Silenciar microfone' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeOnTheScreen()
    expect(screen.queryByText('Notificações')).toBeNull()
  })

  it('sessão salva no Keystore: /canal/<id> abre o chat do canal em tela cheia', async () => {
    jest.mocked(loadTokens).mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' })
    await renderRouter('./app', { initialUrl: '/canal/c1?name=geral' })
    expect(await screen.findByLabelText('Mensagem para #geral')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen()
    expect(await screen.findByText('Ainda não há mensagens aqui.')).toBeOnTheScreen()
  })
})
