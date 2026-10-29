import { renderRouter, screen } from 'expo-router/testing-library'
import { loadTokens } from '../src/features/auth/lib/secureTokens'
import { useAuthStore } from '../src/features/auth/store/authStore'
import { useCallSessionStore } from '../src/features/call/store/callSessionStore'
import { useIncomingCallStore } from '../src/features/call/store/incomingCallStore'

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
  sendChannelMessage: jest.fn(),
  listConversationMessages: jest.fn().mockResolvedValue([]),
  sendConversationMessage: jest.fn()
}))
jest.mock('../src/features/chat/api/conversations', () => ({
  listConversations: jest.fn().mockResolvedValue([]),
  markConversationRead: jest.fn().mockResolvedValue(undefined),
  getOrCreateConversationWith: jest.fn()
}))
jest.mock('../src/features/friends/api/friends', () => ({
  listFriends: jest.fn().mockResolvedValue([]),
  listPending: jest.fn().mockResolvedValue([]),
  listBlocked: jest.fn().mockResolvedValue([])
}))
jest.mock('../src/features/friends/api/presence', () => ({ fetchPresence: jest.fn().mockResolvedValue({}) }))
jest.mock('../src/features/auth/api/auth', () => ({
  ...jest.requireActual('../src/features/auth/api/auth'),
  getMe: jest.fn().mockResolvedValue({ id: 'u1', username: 'ana', display_name: 'Ana', email: 'a@b.co' })
}))
jest.mock('../src/features/call/api/calls', () => ({ listServerCalls: jest.fn().mockResolvedValue([]), getCallState: jest.fn() }))
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()) }
}))

const signIn = () => useAuthStore.setState({ status: 'signedIn', accessToken: 'a', refreshToken: 'r' })

// Regressão: sem sessão o app abre em "/" e precisa cair no login, não em "Unmatched Route".
describe('rotas do app', () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState(), true)
    useCallSessionStore.getState().reset()
    useIncomingCallStore.getState().clear()
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
    expect(screen.getByLabelText('Encontre ou comece uma conversa')).toBeOnTheScreen()
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

  it('sessão salva: /amigos abre a tela de Amigos com as abas', async () => {
    jest.mocked(loadTokens).mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' })
    await renderRouter('./app', { initialUrl: '/amigos' })
    expect(await screen.findByRole('tab', { name: 'Pendentes' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Adicionar amigo' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen()
  })

  it('sessão salva: /dm/<id> abre a conversa 1 a 1 em tela cheia', async () => {
    jest.mocked(loadTokens).mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' })
    await renderRouter('./app', { initialUrl: '/dm/d1?name=Paulo&type=dm' })
    expect(await screen.findByLabelText('Mensagem para @Paulo')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen()
  })

  it('sessão salva: /chamada mostra a tela da chamada em andamento', async () => {
    jest.mocked(loadTokens).mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' })
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', channelId: 'v1', name: 'sala-1' })
    await renderRouter('./app', { initialUrl: '/chamada' })
    expect(await screen.findByRole('button', { name: 'Sair da chamada' })).toBeOnTheScreen()
    expect(screen.getByText('sala-1')).toBeOnTheScreen()
  })

  it('sessão salva: chamada de DM tocando abre a tela de atender sozinha', async () => {
    jest.mocked(loadTokens).mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' })
    await renderRouter('./app', { initialUrl: '/' })
    await screen.findByRole('button', { name: 'Mensagens diretas' })
    useIncomingCallStore.getState().ring({ callId: 'c9', conversationId: 'cv', initiator: { id: 'u2', username: 'bia', display_name: 'Bia' } })
    expect(await screen.findByRole('button', { name: 'Atender' })).toBeOnTheScreen()
    expect(screen.getByText('Está te ligando')).toBeOnTheScreen()
  })
})
