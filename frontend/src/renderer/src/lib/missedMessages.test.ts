import { describe, expect, it } from 'vitest'
import { mergeMissedMessages, newestTime } from './missedMessages'

interface Msg {
  id: string
  created_at: string
  content?: string
}

const at = (minute: number): string => `2026-10-25T10:${String(minute).padStart(2, '0')}:00Z`
const msg = (id: string, minute: number, content = id): Msg => ({
  id,
  created_at: at(minute),
  content
})
/** O servidor devolve da mais nova para a mais antiga. */
const newestFirst = (...list: Msg[]): Msg[] => [...list].reverse()

describe('mergeMissedMessages', () => {
  it('acrescenta só o que chegou depois da última mensagem conhecida', () => {
    const current = [msg('a', 1), msg('b', 2)]
    const page = newestFirst(msg('a', 1), msg('b', 2), msg('c', 3), msg('d', 4))

    const result = mergeMissedMessages(current, page)

    expect(result.messages.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(result.added.map((m) => m.id)).toEqual(['c', 'd'])
    expect(result.reset).toBe(false)
  })

  it('não duplica o que já chegou pelo WebSocket enquanto buscava', () => {
    const current = [msg('a', 1), msg('b', 2), msg('c', 3)]
    const page = newestFirst(msg('a', 1), msg('b', 2), msg('c', 3))

    const result = mergeMissedMessages(current, page)

    expect(result.messages.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(result.added).toEqual([])
  })

  it('mantém as mensagens antigas carregadas (fora da página)', () => {
    const current = [msg('velha', 0), msg('a', 1)]
    const page = newestFirst(msg('a', 1), msg('b', 2))

    const result = mergeMissedMessages(current, page)

    expect(result.messages.map((m) => m.id)).toEqual(['velha', 'a', 'b'])
  })

  it('troca as mensagens da página pela versão do servidor (reações, enquetes)', () => {
    const current = [msg('a', 1, 'antes'), msg('b', 2)]
    const page = newestFirst(msg('a', 1, 'depois'), msg('b', 2))

    const result = mergeMissedMessages(current, page)

    expect(result.messages[0].content).toBe('depois')
  })

  it('tira o que foi apagado durante a queda (dentro da página)', () => {
    const current = [msg('velha', 0), msg('a', 1), msg('apagada', 2), msg('b', 3)]
    const page = newestFirst(msg('a', 1), msg('b', 3))

    const result = mergeMissedMessages(current, page)

    expect(result.messages.map((m) => m.id)).toEqual(['velha', 'a', 'b'])
  })

  it('perdeu mais que uma página: recomeça pela página nova', () => {
    const current = [msg('a', 1), msg('b', 2)]
    const page = newestFirst(msg('x', 10), msg('y', 11))

    const result = mergeMissedMessages(current, page)

    expect(result.messages.map((m) => m.id)).toEqual(['x', 'y'])
    expect(result.added.map((m) => m.id)).toEqual(['x', 'y'])
    expect(result.reset).toBe(true)
  })

  it('mantém o que chegou pelo WebSocket depois da busca (mais novo que a página)', () => {
    const current = [msg('a', 1), msg('nova', 5)]
    const page = newestFirst(msg('a', 1), msg('b', 2))

    const result = mergeMissedMessages(current, page)

    expect(result.messages.map((m) => m.id)).toEqual(['a', 'b', 'nova'])
    expect(result.added.map((m) => m.id)).toEqual(['b'])
  })

  it('compara horários pelo valor, não pelo texto (frações de segundo variam)', () => {
    const current = [{ id: 'a', created_at: '2026-10-25T10:00:00Z' }]
    const page = [
      { id: 'b', created_at: '2026-10-25T10:00:00.5Z' },
      { id: 'a', created_at: '2026-10-25T10:00:00Z' }
    ]

    const result = mergeMissedMessages(current, page)

    expect(result.messages.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('sala vazia: fica com a página', () => {
    const result = mergeMissedMessages([], newestFirst(msg('a', 1)))
    expect(result.messages.map((m) => m.id)).toEqual(['a'])
    expect(result.added.map((m) => m.id)).toEqual(['a'])
  })

  it('página vazia não apaga o que está na tela (inclusive o que chegou pelo WS)', () => {
    const result = mergeMissedMessages([msg('a', 1)], [])
    expect(result.messages.map((m) => m.id)).toEqual(['a'])
    expect(result.added).toEqual([])
  })

  it('não lidas: só o que é mais novo que a última mensagem conhecida', () => {
    // Sala com só a mensagem nova que chegou pelo WS: as 2 antigas da página
    // não são "novas" para o usuário.
    const current = [msg('nova', 5)]
    const page = newestFirst(msg('x', 1), msg('y', 2), msg('nova', 5), msg('depois', 6))

    const result = mergeMissedMessages(current, page)

    expect(result.unseen.map((m) => m.id)).toEqual(['depois'])
  })

  it('não lidas contam a partir do que se conhecia quando a busca começou', () => {
    // Antes da busca a sala tinha só "a"; enquanto buscava, "c" chegou pelo
    // WS. "b" se perdeu na queda e é mais velha que "c", mas é não lida.
    const before = [msg('a', 1)]
    const current = [msg('a', 1), msg('c', 5)]
    const page = newestFirst(msg('a', 1), msg('b', 3))

    const result = mergeMissedMessages(current, page, newestTime(before))

    expect(result.unseen.map((m) => m.id)).toEqual(['b'])
    expect(result.messages.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('sala carregada vazia: tudo que chegou é não lido', () => {
    const result = mergeMissedMessages([], newestFirst(msg('a', 1), msg('b', 2)))
    expect(result.unseen.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('mensagem fora da página com o mesmo horário da borda não some', () => {
    // O Postgres guarda microssegundos; Date.parse corta em milissegundos.
    const current = [
      { id: 'velha', created_at: '2026-10-25T10:00:00.123Z' },
      { id: 'a', created_at: '2026-10-25T10:00:00.123Z' }
    ]
    const page = [
      { id: 'b', created_at: '2026-10-25T10:00:01Z' },
      { id: 'a', created_at: '2026-10-25T10:00:00.123Z' }
    ]

    const result = mergeMissedMessages(current, page)

    expect(result.messages.map((m) => m.id)).toEqual(['velha', 'a', 'b'])
  })

  it('página de uma mensagem só não duplica quem tem o mesmo horário', () => {
    const current = [msg('irma', 1), msg('a', 1)]
    const result = mergeMissedMessages(current, newestFirst(msg('a', 1)))
    expect(result.messages.map((m) => m.id)).toEqual(['irma', 'a'])
  })
})
