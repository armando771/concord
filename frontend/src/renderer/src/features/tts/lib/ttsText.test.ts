import { describe, expect, it } from 'vitest'
import type { Message } from '../../chat/api/messages'
import { spokenText } from './ttsText'

const msg = (content: string, extra: Partial<Message> = {}): Message => ({
  id: 'm1',
  author_id: 'u1',
  author: { id: 'u1', username: 'ana', display_name: 'Ana Paula' },
  content,
  created_at: '',
  ...extra
})

describe('spokenText', () => {
  it('diz quem falou', () => {
    expect(spokenText(msg('bom dia'), { labels: {} })).toBe('Ana Paula disse: bom dia')
  })
  it('usa o apelido do autor no servidor', () => {
    expect(spokenText(msg('oi'), { labels: {}, authorNickname: 'Aninha' })).toBe('Aninha disse: oi')
  })
  it('lê o nome no lugar do @nick', () => {
    expect(spokenText(msg('oi @bia_2, tudo bem?'), { labels: { bia_2: 'Beatriz' } })).toBe(
      'Ana Paula disse: oi Beatriz, tudo bem?'
    )
  })
  it('nick desconhecido fica sem o @', () => {
    expect(spokenText(msg('oi @zeca'), { labels: {} })).toBe('Ana Paula disse: oi zeca')
  })
  it('@all e @here liberados viram palavras', () => {
    expect(spokenText(msg('@all bora', { mention_everyone: 'all' }), { labels: {} })).toBe(
      'Ana Paula disse: todo mundo bora'
    )
  })
  it('link vira "link" e emojis saem', () => {
    expect(
      spokenText(msg('olha https://exemplo.com/um/caminho/bem/longo?x=1 😂🔥 :pepe_triste: kkk'), {
        labels: {}
      })
    ).toBe('Ana Paula disse: olha link kkk')
  })
  it('sem nada para ler depois da limpeza, só diz o nome', () => {
    expect(spokenText(msg('😂'), { labels: {} })).toBe('Ana Paula disse: ')
  })
})
