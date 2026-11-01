import type { Message } from '../api/messages'
import { mergeMessages, oldestId, removeMessage } from './messageList'

const msg = (id: string, createdAt: string, content = id): Message => ({
  id,
  author_id: 'u1',
  content,
  created_at: createdAt
})

const A = msg('a', '2026-10-28T10:00:00Z')
const B = msg('b', '2026-10-28T10:01:00Z')
const C = msg('c', '2026-10-28T10:02:00Z')

describe('mergeMessages', () => {
  it('ordena da mais nova para a mais antiga, qualquer que seja a ordem de entrada', () => {
    expect(mergeMessages([], [A, C, B]).map((m) => m.id)).toEqual(['c', 'b', 'a'])
  })

  it('não duplica por id e fica com a versão nova (edição)', () => {
    const edited = msg('b', '2026-10-28T10:01:00Z', 'editada')
    const merged = mergeMessages([C, B, A], [edited])
    expect(merged.map((m) => m.id)).toEqual(['c', 'b', 'a'])
    expect(merged[1].content).toBe('editada')
  })

  it('empate de horário desempata pelo id (estável)', () => {
    const x = msg('x', '2026-10-28T10:00:00Z')
    const y = msg('y', '2026-10-28T10:00:00Z')
    expect(mergeMessages([], [x, y]).map((m) => m.id)).toEqual(['y', 'x'])
  })

  it('não muda a lista de entrada', () => {
    const current = [B, A]
    mergeMessages(current, [C])
    expect(current.map((m) => m.id)).toEqual(['b', 'a'])
  })
})

describe('removeMessage', () => {
  it('tira pelo id', () => {
    expect(removeMessage([C, B, A], 'b').map((m) => m.id)).toEqual(['c', 'a'])
  })
  it('id desconhecido não muda nada', () => {
    expect(removeMessage([B, A], 'zzz')).toHaveLength(2)
  })
})

describe('oldestId', () => {
  it('é o cursor da próxima página (a mais antiga carregada)', () => {
    expect(oldestId([C, B, A])).toBe('a')
  })
  it('lista vazia: sem cursor', () => {
    expect(oldestId([])).toBeUndefined()
  })
})
