import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { WsEvent } from '../../../shared/api/ws'
import { getOrCreateConversationWith } from '../../chat/api/conversations'
import * as api from '../api/friends'
import type { Friend, PendingRequest } from '../api/friends'
import { fetchPresence } from '../api/presence'
import { usePresenceStore } from '../store/presenceStore'
import { useFriendsStore } from '../store/friendsStore'
import { FriendsScreen } from './FriendsScreen'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 48, bottom: 24, left: 0, right: 0 })
}))
jest.mock('../api/friends')
jest.mock('../api/presence')
jest.mock('../../chat/api/conversations', () => ({ getOrCreateConversationWith: jest.fn() }))
jest.mock('../../../shared/api/ws', () => ({ onWsEvent: jest.fn((_l: (e: WsEvent) => void) => () => {}) }))
jest.mock('../../../shared/api/realtime', () => ({ onRealtimeReconnect: jest.fn(() => () => {}) }))

const m = jest.mocked(api)
const person = (id: string, name: string): Friend => ({ id, username: id, display_name: name })
const req = (id: string, name: string, direction: 'incoming' | 'outgoing'): PendingRequest => ({
  user_id: id,
  username: id,
  display_name: name,
  direction,
  created_at: ''
})

describe('FriendsScreen', () => {
  const onBack = jest.fn()
  const onOpenConversation = jest.fn()
  const setup = () => render(<FriendsScreen onBack={onBack} onOpenConversation={onOpenConversation} />)
  const tab = (name: string) => fireEvent.press(screen.getByRole('tab', { name }))
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }))

  beforeEach(() => {
    jest.clearAllMocks()
    useFriendsStore.setState(useFriendsStore.getInitialState(), true)
    usePresenceStore.setState(usePresenceStore.getInitialState(), true)
    m.listFriends.mockResolvedValue([person('ana', 'Ana'), person('beto', 'Beto')])
    m.listPending.mockResolvedValue([req('caio', 'Caio', 'incoming'), req('duda', 'Duda', 'outgoing')])
    m.listBlocked.mockResolvedValue([person('edu', 'Edu')])
    jest.mocked(fetchPresence).mockResolvedValue({ ana: 'online', beto: 'offline' })
  })

  it('Online mostra só quem está online; Todos mostra todos', async () => {
    await setup()
    expect(await screen.findByText('Ana')).toBeOnTheScreen()
    expect(screen.queryByText('Beto')).toBeNull()
    await tab('Todos')
    expect(screen.getByText('Beto')).toBeOnTheScreen()
  })

  it('Online sem ninguém: aviso', async () => {
    jest.mocked(fetchPresence).mockResolvedValue({})
    await setup()
    expect(await screen.findByText('Nenhum amigo online agora.')).toBeOnTheScreen()
  })

  it('Todos sem amigos: aviso', async () => {
    m.listFriends.mockResolvedValue([])
    await setup()
    await tab('Todos')
    expect(await screen.findByText('Você ainda não tem amigos.')).toBeOnTheScreen()
  })

  it('Pendentes: recebido (aceitar, recusar) e enviado (cancelar)', async () => {
    m.acceptFriendRequest.mockResolvedValue({ message: '' })
    m.cancelFriendRequest.mockResolvedValue({ message: '' })
    await setup()
    await tab('Pendentes')
    expect(await screen.findByText('Pedido recebido')).toBeOnTheScreen()
    expect(screen.getByText('Pedido enviado')).toBeOnTheScreen()
    await press('Aceitar Caio')
    expect(m.acceptFriendRequest).toHaveBeenCalledWith('caio')
    await press('Cancelar pedido Duda')
    expect(m.cancelFriendRequest).toHaveBeenCalledWith('duda')
    expect(screen.getByRole('button', { name: 'Recusar Caio' })).toBeOnTheScreen()
  })

  it('Pendentes vazio: aviso', async () => {
    m.listPending.mockResolvedValue([])
    await setup()
    await tab('Pendentes')
    expect(await screen.findByText('Nenhum pedido pendente.')).toBeOnTheScreen()
  })

  it('Bloqueados: desbloquear; vazio mostra aviso', async () => {
    m.unblockUser.mockResolvedValue({ message: '' })
    await setup()
    await tab('Bloqueados')
    m.listBlocked.mockResolvedValue([]) // o servidor já não lista depois de desbloquear
    await press('Desbloquear Edu')
    expect(m.unblockUser).toHaveBeenCalledWith('edu')
    await waitFor(() => expect(screen.getByText('Ninguém bloqueado.')).toBeOnTheScreen())
  })

  it('remover amigo pede confirmação; Cancelar não chama a API, Confirmar chama', async () => {
    m.removeFriend.mockResolvedValue({ message: '' })
    await setup()
    await screen.findByText('Ana')
    await press('Remover amigo Ana')
    expect(screen.getByText('Remover Ana dos amigos?')).toBeOnTheScreen()
    await press('Cancelar')
    expect(m.removeFriend).not.toHaveBeenCalled()
    await press('Remover amigo Ana')
    await press('Confirmar')
    expect(m.removeFriend).toHaveBeenCalledWith('ana')
  })

  it('bloquear pede confirmação e usa o id', async () => {
    m.blockUser.mockResolvedValue({ message: '' })
    await setup()
    await screen.findByText('Ana')
    await press('Bloquear Ana')
    expect(screen.getByText('Bloquear Ana?')).toBeOnTheScreen()
    await press('Confirmar')
    expect(m.blockUser).toHaveBeenCalledWith('ana')
  })

  it('Mensagem abre (cria) a DM com o amigo', async () => {
    jest.mocked(getOrCreateConversationWith).mockResolvedValue({ id: 'd9' })
    await setup()
    await screen.findByText('Ana')
    await press('Mensagem Ana')
    await waitFor(() => expect(onOpenConversation).toHaveBeenCalledWith({ id: 'd9', title: 'Ana', type: 'dm' }))
  })

  it('falha ao abrir a DM: aviso', async () => {
    jest.mocked(getOrCreateConversationWith).mockRejectedValue(new Error('x'))
    await setup()
    await screen.findByText('Ana')
    await press('Mensagem Ana')
    expect(await screen.findByText('Não foi possível abrir a conversa.')).toBeOnTheScreen()
  })

  it('falha de ação: aviso e a lista continua', async () => {
    m.removeFriend.mockRejectedValue(new Error('x'))
    await setup()
    await screen.findByText('Ana')
    await press('Remover amigo Ana')
    await press('Confirmar')
    expect(await screen.findByText('Não foi possível concluir a ação.')).toBeOnTheScreen()
    expect(screen.getByText('Ana')).toBeOnTheScreen()
  })

  it('Adicionar amigo: pedido enviado, amizade na hora e erros', async () => {
    await setup()
    await press('Adicionar amigo')
    const field = screen.getByLabelText('Nome de usuário')
    m.sendFriendRequest.mockResolvedValueOnce({ message: '', result: 'sent' })
    await fireEvent.changeText(field, ' zeca ')
    await press('Enviar pedido')
    expect(m.sendFriendRequest).toHaveBeenCalledWith('zeca')
    expect(await screen.findByText('Pedido enviado para zeca.')).toBeOnTheScreen()
    m.sendFriendRequest.mockResolvedValueOnce({ message: '', result: 'accepted' })
    await fireEvent.changeText(field, 'zeca')
    await press('Enviar pedido')
    expect(await screen.findByText('Agora você e zeca são amigos.')).toBeOnTheScreen()
    m.sendFriendRequest.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'user_not_found' }))
    await fireEvent.changeText(field, 'ninguem')
    await press('Enviar pedido')
    expect(await screen.findByText('Usuário não encontrado.')).toBeOnTheScreen()
  })

  it('Adicionar amigo: campo vazio não envia', async () => {
    await setup()
    await press('Adicionar amigo')
    expect(screen.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled()
  })

  it('falha ao carregar: aviso e tentar de novo', async () => {
    m.listFriends.mockRejectedValueOnce(new Error('rede'))
    await setup()
    expect(await screen.findByText('Não foi possível carregar os amigos.')).toBeOnTheScreen()
    await press('Tentar de novo')
    expect(await screen.findByText('Ana')).toBeOnTheScreen()
  })

  it('uma lista falhou mas as outras carregaram: aviso e as listas que vieram continuam', async () => {
    m.listPending.mockRejectedValueOnce(new Error('x'))
    await setup()
    expect(await screen.findByText('Não foi possível carregar os amigos.')).toBeOnTheScreen()
    expect(screen.getByText('Ana')).toBeOnTheScreen()
  })

  // Regressão: a aba "Adicionar amigo" ficava cortada na borda da barra de abas (parecia bug de layout).
  it('Adicionar amigo é um botão do cabeçalho, não uma aba (as 4 listas cabem na largura)', async () => {
    await setup()
    expect(screen.queryByRole('tab', { name: 'Adicionar amigo' })).toBeNull()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Adicionar amigo' })).toBeOnTheScreen()
  })

  it('depois de Adicionar, tocar numa aba volta para a lista', async () => {
    await setup()
    await press('Adicionar amigo')
    expect(screen.getByLabelText('Nome de usuário')).toBeOnTheScreen()
    await tab('Todos')
    expect(await screen.findByText('Beto')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Nome de usuário')).toBeNull()
  })

  it('voltar chama onBack', async () => {
    await setup()
    await press('Voltar')
    expect(onBack).toHaveBeenCalled()
  })
})
