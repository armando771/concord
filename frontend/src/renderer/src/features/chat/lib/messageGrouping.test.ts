import { describe, expect, it } from 'vitest'
import type { Message } from '../api/messages'
import { GROUP_WINDOW_MS, isGroupedWithPrevious } from './messageGrouping'
import { mergeMessages } from './messageOrder'

function msg(id: string, created_at: string, extra: Partial<Message> = {}): Message {
  return { id, author_id: 'a', channel_id: 'c1', content: id, created_at, ...extra }
}

const at = (h: number, m: number, s = 0): string => new Date(2026, 9, 25, h, m, s).toISOString()

/** Quais mensagens da lista (na ordem) viram linha compacta. */
function groupedIds(list: Message[]): string[] {
  return list.filter((m, i) => isGroupedWithPrevious(m, list[i - 1])).map((m) => m.id)
}

describe('isGroupedWithPrevious', () => {
  it('a primeira mensagem nunca é agrupada', () => {
    expect(isGroupedWithPrevious(msg('1', at(12, 0)), undefined)).toBe(false)
  })

  it('agrupa mesma pessoa, mesmo canal, em poucos minutos', () => {
    expect(isGroupedWithPrevious(msg('2', at(12, 3)), msg('1', at(12, 0)))).toBe(true)
  })

  it('quebra com outro autor', () => {
    expect(
      isGroupedWithPrevious(msg('2', at(12, 1), { author_id: 'b' }), msg('1', at(12, 0)))
    ).toBe(false)
  })

  it('quebra com outro canal ou conversa', () => {
    expect(
      isGroupedWithPrevious(msg('2', at(12, 1), { channel_id: 'c2' }), msg('1', at(12, 0)))
    ).toBe(false)
    expect(
      isGroupedWithPrevious(
        msg('2', at(12, 1), { channel_id: null, conversation_id: 'x' }),
        msg('1', at(12, 0), { channel_id: null, conversation_id: 'y' })
      )
    ).toBe(false)
  })

  it('trata channel_id ausente e null como o mesmo valor', () => {
    const a = { ...msg('1', at(12, 0)), channel_id: undefined }
    const b = { ...msg('2', at(12, 1)), channel_id: null }
    expect(isGroupedWithPrevious(b, a)).toBe(true)
  })

  it('quebra a partir de 7 minutos, não antes', () => {
    expect(isGroupedWithPrevious(msg('2', at(12, 6, 59)), msg('1', at(12, 0)))).toBe(true)
    expect(isGroupedWithPrevious(msg('2', at(12, 7)), msg('1', at(12, 0)))).toBe(false)
    expect(GROUP_WINDOW_MS).toBe(420_000)
  })

  it('o tempo vale desde a mensagem anterior, não desde o início do grupo', () => {
    const list = [
      msg('1', at(12, 0)),
      msg('2', at(12, 5)),
      msg('3', at(12, 10)),
      msg('4', at(12, 18))
    ]
    expect(groupedIds(list)).toEqual(['2', '3'])
  })

  it('quebra na virada do dia, mesmo dentro da janela', () => {
    const before = new Date(2026, 9, 25, 23, 58).toISOString()
    const after = new Date(2026, 9, 26, 0, 2).toISOString()
    expect(isGroupedWithPrevious(msg('2', after), msg('1', before))).toBe(false)
  })

  it('quebra se a mensagem é resposta', () => {
    expect(
      isGroupedWithPrevious(msg('2', at(12, 1), { reply_to_id: '1' }), msg('1', at(12, 0)))
    ).toBe(false)
    // reply_to_id nulo mas prévia presente (original apagada) também é resposta
    expect(
      isGroupedWithPrevious(
        msg('2', at(12, 1), { reply_to: { id: '1', content: 'x' } as Message['reply_to'] }),
        msg('1', at(12, 0))
      )
    ).toBe(false)
  })

  it('uma mensagem comum logo depois de uma resposta se agrupa a ela', () => {
    expect(
      isGroupedWithPrevious(msg('2', at(12, 1)), msg('1', at(12, 0), { reply_to_id: 'z' }))
    ).toBe(true)
  })

  it('quebra com mensagem de sistema ou música, antes ou depois', () => {
    const sys = { system_kind: 'birthday' }
    expect(isGroupedWithPrevious(msg('2', at(12, 1), sys), msg('1', at(12, 0)))).toBe(false)
    expect(isGroupedWithPrevious(msg('2', at(12, 1)), msg('1', at(12, 0), sys))).toBe(false)
    expect(
      isGroupedWithPrevious(msg('2', at(12, 1)), msg('1', at(12, 0), { system_kind: 'music' }))
    ).toBe(false)
  })

  it('quebra com enquete, antes ou depois', () => {
    const poll = { poll: { id: 'p' } as unknown as Message['poll'] }
    expect(isGroupedWithPrevious(msg('2', at(12, 1), poll), msg('1', at(12, 0)))).toBe(false)
    expect(isGroupedWithPrevious(msg('2', at(12, 1)), msg('1', at(12, 0), poll))).toBe(false)
  })

  it('anexos e mensagens editadas continuam agrupando', () => {
    const extra = { attachments: [{ id: 'f' }] as Message['attachments'], edited_at: at(12, 30) }
    expect(isGroupedWithPrevious(msg('2', at(12, 1), extra), msg('1', at(12, 0)))).toBe(true)
  })

  it('data inválida ou ordem invertida não agrupa', () => {
    expect(isGroupedWithPrevious(msg('2', 'lixo'), msg('1', at(12, 0)))).toBe(false)
    expect(isGroupedWithPrevious(msg('2', at(12, 0)), msg('1', at(12, 5)))).toBe(false)
  })
})

describe('agrupamento com mergeMessages e loadOlder', () => {
  it('não depende da ordem de chegada', () => {
    const m1 = msg('1', at(12, 0))
    const m2 = msg('2', at(12, 1))
    const m3 = msg('3', at(12, 2), { author_id: 'b' })
    // página da API vem da mais nova para a mais antiga
    const merged = mergeMessages([], [m3, m2, m1])
    expect(groupedIds(merged)).toEqual(['2'])
    expect(groupedIds(mergeMessages(mergeMessages([], [m2]), [m3, m1]))).toEqual(['2'])
  })

  it('mensagem ao vivo no meio muda o agrupamento dos vizinhos', () => {
    const m1 = msg('1', at(12, 0))
    const m3 = msg('3', at(12, 2))
    expect(groupedIds([m1, m3])).toEqual(['3'])
    const merged = mergeMessages([m1, m3], [msg('2', at(12, 1), { author_id: 'b' })])
    expect(groupedIds(merged)).toEqual([])
  })

  it('loadOlder: a primeira da página antiga vira cabeçalho e a antiga primeira passa a agrupar', () => {
    const current = [msg('3', at(12, 2)), msg('4', at(12, 3))]
    expect(groupedIds(current)).toEqual(['4'])
    const older = [msg('2', at(12, 1)), msg('1', at(12, 0))]
    const merged = mergeMessages(current, older)
    expect(merged.map((m) => m.id)).toEqual(['1', '2', '3', '4'])
    expect(groupedIds(merged)).toEqual(['2', '3', '4'])
  })

  it('mesmo created_at: o desempate por id mantém a decisão estável', () => {
    const merged = mergeMessages([], [msg('b', at(12, 0)), msg('a', at(12, 0))])
    expect(merged.map((m) => m.id)).toEqual(['a', 'b'])
    expect(groupedIds(merged)).toEqual(['b'])
  })
})
