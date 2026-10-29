import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useCallSessionStore } from '../../call/store/callSessionStore'
import { listChannels, type Channel } from '../api/channels'
import { listServers, type Server } from '../api/servers'
import { useSelectedServerStore } from '../store/selectedServerStore'
import { useServersStore } from '../store/serversStore'
import { HomeScreen } from './HomeScreen'

jest.mock('expo-secure-store')
jest.mock('../api/servers')
jest.mock('../api/channels')
jest.mock('../../chat/api/conversations', () => ({ listConversations: jest.fn().mockResolvedValue([]) }))
jest.mock('../../friends/api/friends', () => ({ listFriends: jest.fn().mockResolvedValue([]) }))
jest.mock('../../friends/api/presence', () => ({ fetchPresence: jest.fn().mockResolvedValue({}) }))
jest.mock('../../call/api/calls', () => ({ listServerCalls: jest.fn().mockResolvedValue([]) }))

const servers = jest.mocked(listServers)
const channels = jest.mocked(listChannels)
const srv = (id: string, name: string): Server => ({ id, name, owner_id: 'u' })
const ch = (id: string, name: string, serverId: string): Channel => ({
  id,
  server_id: serverId,
  name,
  type: 'text',
  created_by: 'u',
  created_at: '',
  updated_at: ''
})

describe('HomeScreen', () => {
  const onOpenChannel = jest.fn()
  const onOpenSettings = jest.fn()
  const onOpenConversation = jest.fn()
  const onOpenFriends = jest.fn()
  const onJoinVoice = jest.fn()
  const onOpenCall = jest.fn()
  const onLeaveCall = jest.fn()
  const setup = () =>
    render(
      <HomeScreen
        onOpenChannel={onOpenChannel}
        onOpenConversation={onOpenConversation}
        onOpenFriends={onOpenFriends}
        onJoinVoice={onJoinVoice}
        onOpenCall={onOpenCall}
        onLeaveCall={onLeaveCall}
        onOpenSettings={onOpenSettings}
      />
    )

  beforeEach(() => {
    jest.clearAllMocks()
    useCallSessionStore.getState().reset()
    useServersStore.setState(useServersStore.getInitialState(), true)
    useSelectedServerStore.setState(useSelectedServerStore.getInitialState(), true)
    servers.mockResolvedValue([srv('s1', 'BH RX'), srv('s2', 'Stations')])
    channels.mockImplementation(async (id) => (id === 's1' ? [ch('c1', 'geral', 's1')] : [ch('c2', 'avisos', 's2')]))
  })

  it('abre no primeiro servidor, com os canais dele', async () => {
    await setup()
    expect(await screen.findByRole('button', { name: 'geral' })).toBeOnTheScreen()
    expect(screen.getByText('BH RX')).toBeOnTheScreen()
    expect(channels).toHaveBeenCalledWith('s1')
  })

  it('tocar em outro servidor carrega os canais dele', async () => {
    await setup()
    await screen.findByRole('button', { name: 'geral' })
    await fireEvent.press(screen.getByRole('button', { name: 'Stations' }))
    expect(await screen.findByRole('button', { name: 'avisos' })).toBeOnTheScreen()
  })

  it('tocar num canal de texto avisa quem abre o chat', async () => {
    await setup()
    await fireEvent.press(await screen.findByRole('button', { name: 'geral' }))
    expect(onOpenChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', name: 'geral' }))
  })

  it('tocar num canal de voz entra na chamada', async () => {
    channels.mockImplementation(async () => [{ ...ch('v1', 'sala-1', 's1'), type: 'voice' }])
    await setup()
    await fireEvent.press(await screen.findByRole('button', { name: 'sala-1' }))
    expect(onJoinVoice).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' }))
  })

  it('em chamada, a barra aparece acima do painel e abre a tela cheia', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', name: 'sala-1' })
    await setup()
    await fireEvent.press(await screen.findByRole('button', { name: 'Abrir chamada em sala-1' }))
    expect(onOpenCall).toHaveBeenCalled()
  })

  it('DMs: o ícone do topo abre o painel com a busca e a lista de conversas', async () => {
    await setup()
    await screen.findByRole('button', { name: 'geral' })
    await fireEvent.press(screen.getByRole('button', { name: 'Mensagens diretas' }))
    expect(screen.getByLabelText('Encontre ou comece uma conversa')).toBeOnTheScreen()
    expect(await screen.findByText('Você ainda não tem conversas.')).toBeOnTheScreen()
  })

  it('a engrenagem do painel abre as configurações', async () => {
    await setup()
    await fireEvent.press(screen.getByRole('button', { name: 'Configurações' }))
    expect(onOpenSettings).toHaveBeenCalled()
  })

  it('falha ao carregar os servidores: aviso e tentar de novo', async () => {
    servers.mockRejectedValueOnce(new Error('rede'))
    await setup()
    expect(await screen.findByText('Não foi possível carregar os servidores.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'geral' })).toBeOnTheScreen())
  })
})
