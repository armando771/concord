import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { WsEvent } from '../../../shared/api/ws'
import { useAuthStore } from '../../auth/store/authStore'
import { listFriends } from '../../friends/api/friends'
import { fetchPresence } from '../../friends/api/presence'
import { usePresenceStore } from '../../friends/store/presenceStore'
import { getOrCreateConversationWith, listConversations, type ConversationPerson, type ConversationSummary } from '../api/conversations'
import { useConversationsStore } from '../store/conversationsStore'
import { DirectMessages } from './DirectMessages'

jest.mock('expo-secure-store')
jest.mock('../api/conversations')
jest.mock('../../friends/api/friends')
jest.mock('../../friends/api/presence')
let wsHandler: (event: WsEvent) => void = () => {}
jest.mock('../../../shared/api/ws', () => ({
  onWsEvent: jest.fn((l: (e: WsEvent) => void) => ((wsHandler = l), () => {}))
}))
jest.mock('../../../shared/api/realtime', () => ({ onRealtimeReconnect: jest.fn(() => () => {}) }))

const list = jest.mocked(listConversations)
const friends = jest.mocked(listFriends)
const presence = jest.mocked(fetchPresence)
const open = jest.mocked(getOrCreateConversationWith)

const person = (id: string, name: string): ConversationPerson => ({ id, username: id, display_name: name })
const ME = person('me', 'Eu')
const dm = (id: string, other: ConversationPerson, at: string): ConversationSummary => ({
  id,
  type: 'dm',
  name: '',
  other_user: other,
  members: [ME, other],
  unread_count: 0,
  created_at: at,
  updated_at: at
})
const group = (id: string, name: string, at: string): ConversationSummary => ({
  id,
  type: 'group',
  name,
  members: [ME, person('a', 'A'), person('b', 'B')],
  unread_count: 0,
  created_at: at,
  updated_at: at
})
const T1 = '2026-10-28T10:00:00Z'
const T2 = '2026-10-28T11:00:00Z'

describe('DirectMessages', () => {
  const onOpenConversation = jest.fn()
  const onOpenFriends = jest.fn()
  const setup = () => render(<DirectMessages onOpenConversation={onOpenConversation} onOpenFriends={onOpenFriends} />)

  beforeEach(() => {
    jest.clearAllMocks()
    useConversationsStore.setState(useConversationsStore.getInitialState(), true)
    usePresenceStore.setState(usePresenceStore.getInitialState(), true)
    useAuthStore.setState({ user: { id: 'me', username: 'eu', display_name: 'Eu', email: 'e@x.co' } })
    list.mockResolvedValue([dm('d1', person('u1', 'Paulo Kogos'), T1), group('g1', 'DEVS do SALINHA', T2)])
    friends.mockResolvedValue([person('f1', 'Maria José'), person('u1', 'Paulo Kogos')])
    presence.mockResolvedValue({ u1: 'online' })
  })

  it('mostra as conversas: DM pelo nome do outro e grupo com "N membros"', async () => {
    await setup()
    expect(await screen.findByRole('button', { name: 'Paulo Kogos' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'DEVS do SALINHA' })).toBeOnTheScreen()
    expect(screen.getByText('3 membros')).toBeOnTheScreen()
    expect(screen.getByText('Mensagens diretas')).toBeOnTheScreen()
  })

  it('conversa com não lidas mostra o selo com o número', async () => {
    list.mockResolvedValue([{ ...dm('d1', person('u1', 'Paulo Kogos'), T1), unread_count: 3 }, group('g1', 'DEVS do SALINHA', T2)])
    await setup()
    expect(await screen.findByLabelText('3 mensagens não lidas')).toBeOnTheScreen()
    expect(screen.getAllByLabelText(/não lidas?$/)).toHaveLength(1)
  })

  it('a DM 1 a 1 mostra a presença; o grupo não', async () => {
    await setup()
    await screen.findByRole('button', { name: 'Paulo Kogos' })
    await waitFor(() => expect(screen.getByLabelText('Online')).toBeOnTheScreen())
    expect(screen.getAllByLabelText(/Online|Offline|Ausente|Não perturbe/)).toHaveLength(1)
  })

  it('presence:update do WebSocket troca a bolinha', async () => {
    await setup()
    await waitFor(() => expect(screen.getByLabelText('Online')).toBeOnTheScreen())
    await act(async () => wsHandler({ type: 'presence:update', payload: { user_id: 'u1', status: 'dnd' } }))
    expect(screen.getByLabelText('Não perturbe')).toBeOnTheScreen()
  })

  it('o botão Amigos abre a tela de amigos', async () => {
    await setup()
    await fireEvent.press(await screen.findByRole('button', { name: 'Amigos' }))
    expect(onOpenFriends).toHaveBeenCalled()
  })

  it('tocar numa conversa avisa quem abre o chat', async () => {
    await setup()
    await fireEvent.press(await screen.findByRole('button', { name: 'DEVS do SALINHA' }))
    expect(onOpenConversation).toHaveBeenCalledWith({ id: 'g1', title: 'DEVS do SALINHA', type: 'group' })
  })

  it('a busca filtra as conversas sem acento nem maiúsculas', async () => {
    await setup()
    await screen.findByRole('button', { name: 'Paulo Kogos' })
    await fireEvent.changeText(screen.getByLabelText('Encontre ou comece uma conversa'), 'KOGOS')
    expect(screen.getByRole('button', { name: 'Paulo Kogos' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'DEVS do SALINHA' })).toBeNull()
  })

  it('a busca oferece amigo sem conversa; tocar abre (cria) a DM', async () => {
    open.mockResolvedValue({ id: 'novo' })
    await setup()
    await screen.findByRole('button', { name: 'Paulo Kogos' })
    await fireEvent.changeText(screen.getByLabelText('Encontre ou comece uma conversa'), 'jose')
    // o botão "Amigos" do topo e o título da seção dos resultados
    await waitFor(() => expect(screen.getAllByText('Amigos')).toHaveLength(2))
    await fireEvent.press(screen.getByRole('button', { name: 'Maria José' }))
    await waitFor(() => expect(onOpenConversation).toHaveBeenCalledWith({ id: 'novo', title: 'Maria José', type: 'dm' }))
    expect(open).toHaveBeenCalledWith('f1')
  })

  it('falha ao abrir a conversa com o amigo: aviso e a busca continua', async () => {
    open.mockRejectedValue(new Error('x'))
    await setup()
    await screen.findByRole('button', { name: 'Paulo Kogos' })
    await fireEvent.changeText(screen.getByLabelText('Encontre ou comece uma conversa'), 'jose')
    await fireEvent.press(await screen.findByRole('button', { name: 'Maria José' }))
    expect(await screen.findByText('Não foi possível abrir a conversa.')).toBeOnTheScreen()
    expect(onOpenConversation).not.toHaveBeenCalled()
  })

  it('busca sem nenhum resultado', async () => {
    await setup()
    await screen.findByRole('button', { name: 'Paulo Kogos' })
    await fireEvent.changeText(screen.getByLabelText('Encontre ou comece uma conversa'), 'zzzz')
    expect(screen.getByText('Nada encontrado.')).toBeOnTheScreen()
  })

  it('sem conversas: convite', async () => {
    list.mockResolvedValue([])
    await setup()
    expect(await screen.findByText('Você ainda não tem conversas.')).toBeOnTheScreen()
  })

  it('falha ao carregar: aviso e tentar de novo', async () => {
    list.mockRejectedValueOnce(new Error('rede'))
    await setup()
    expect(await screen.findByText('Não foi possível carregar as conversas.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('button', { name: 'Paulo Kogos' })).toBeOnTheScreen()
  })
})
