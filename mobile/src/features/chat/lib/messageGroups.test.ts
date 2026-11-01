import type { Message } from '../api/messages'
import { groupMessages, GROUP_WINDOW_MS } from './messageGroups'

const msg = (id: string, author: string, iso: string): Message => ({
  id,
  author_id: author,
  content: id,
  created_at: iso
})

// Entrada e saída da mais nova para a mais antiga (lista invertida).
describe('groupMessages', () => {
  it('mesma pessoa em seguida: só a mais antiga do bloco mostra o cabeçalho', () => {
    const items = groupMessages([msg('2', 'a', '2026-10-28T10:01:00Z'), msg('1', 'a', '2026-10-28T10:00:00Z')])
    expect(items.map((i) => [i.message.id, i.showHeader])).toEqual([
      ['2', false],
      ['1', true]
    ])
  })

  it('pessoa diferente quebra o bloco', () => {
    const items = groupMessages([msg('2', 'b', '2026-10-28T10:01:00Z'), msg('1', 'a', '2026-10-28T10:00:00Z')])
    expect(items.every((i) => i.showHeader)).toBe(true)
  })

  it('pausa maior que a janela quebra o bloco', () => {
    const later = new Date(Date.parse('2026-10-28T10:00:00Z') + GROUP_WINDOW_MS + 1000).toISOString()
    const items = groupMessages([msg('2', 'a', later), msg('1', 'a', '2026-10-28T10:00:00Z')])
    expect(items.every((i) => i.showHeader)).toBe(true)
  })

  it('mudança de dia quebra o bloco e marca o separador no começo do dia', () => {
    const items = groupMessages(
      [msg('2', 'a', '2026-10-29T12:00:00Z'), msg('1', 'a', '2026-10-28T12:00:00Z')],
      'UTC'
    )
    expect(items[1].showHeader).toBe(true)
    expect(items[1].dayLabel).toBe('2026-10-28')
    expect(items[0].dayLabel).toBe('2026-10-29')
    expect(items[0].showHeader).toBe(true)
  })

  it('dia repetido não repete o separador', () => {
    const items = groupMessages([msg('2', 'a', '2026-10-28T12:30:00Z'), msg('1', 'a', '2026-10-28T12:00:00Z')], 'UTC')
    expect(items[0].dayLabel).toBeNull()
    expect(items[1].dayLabel).toBe('2026-10-28')
  })

  it('lista vazia', () => {
    expect(groupMessages([])).toEqual([])
  })
})
