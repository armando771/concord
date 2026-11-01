import type { Friend, PendingRequest } from '../api/friends'
import { addFailureMessage, addSuccessMessage, onlineFriends, sortByName, splitPending } from './friendLists'

const friend = (id: string, name: string): Friend => ({ id, username: id, display_name: name })
const pending = (id: string, name: string, direction: 'incoming' | 'outgoing'): PendingRequest => ({
  user_id: id,
  username: id,
  display_name: name,
  direction,
  created_at: '2026-10-28T10:00:00Z'
})

describe('sortByName', () => {
  it('ordem alfabética sem acento nem maiúsculas, sem mudar a lista de entrada', () => {
    const list = [friend('3', 'zé'), friend('1', 'Ana'), friend('2', 'álvaro')]
    expect(sortByName(list).map((f) => f.id)).toEqual(['2', '1', '3'])
    expect(list.map((f) => f.id)).toEqual(['3', '1', '2'])
  })
})

describe('onlineFriends', () => {
  const list = [friend('a', 'Ana'), friend('b', 'Beto'), friend('c', 'Caio'), friend('d', 'Duda')]

  it('online, ausente e não perturbe contam como online; offline e sem status, não', () => {
    const statuses = { a: 'online', b: 'idle', c: 'dnd', d: 'offline' } as const
    expect(onlineFriends(list, statuses).map((f) => f.id)).toEqual(['a', 'b', 'c'])
    expect(onlineFriends(list, {})).toEqual([])
  })
})

describe('splitPending', () => {
  it('separa recebidos e enviados, cada um por nome', () => {
    const result = splitPending([pending('1', 'Zé', 'incoming'), pending('2', 'Ana', 'outgoing'), pending('3', 'Bia', 'incoming')])
    expect(result.incoming.map((p) => p.user_id)).toEqual(['3', '1'])
    expect(result.outgoing.map((p) => p.user_id)).toEqual(['2'])
  })
})

describe('mensagens de "Adicionar amigo"', () => {
  it('sucesso: pedido enviado ou amizade na hora', () => {
    expect(addSuccessMessage('sent', 'Ana')).toBe('Pedido enviado para Ana.')
    expect(addSuccessMessage('accepted', 'Ana')).toBe('Agora você e Ana são amigos.')
  })

  it('falha: usuário inexistente, já amigos, ou genérica', () => {
    expect(addFailureMessage({ status: 404, code: 'user_not_found' })).toBe('Usuário não encontrado.')
    expect(addFailureMessage({ status: 409, code: 'already_friends' })).toBe('Vocês já são amigos.')
    expect(addFailureMessage({ status: 409, code: 'request_exists' })).toBe('Não foi possível enviar o pedido.')
    expect(addFailureMessage(new Error('rede'))).toBe('Não foi possível enviar o pedido.')
    expect(addFailureMessage(undefined)).toBe('Não foi possível enviar o pedido.')
  })
})
