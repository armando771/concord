import { describe, expect, it } from 'vitest'
import {
  applyMention,
  everyonePingsMe,
  everyoneSuggestions,
  mentionQuery,
  messageMentionsMe,
  mentionsUser,
  splitMentions
} from './mentions'

describe('mentionsUser', () => {
  it('reconhece @nick no começo, no meio e com pontuação', () => {
    expect(mentionsUser('@fulano bora?', 'fulano')).toBe(true)
    expect(mentionsUser('valeu @fulano!', 'fulano')).toBe(true)
    expect(mentionsUser('ei @FULANO', 'fulano')).toBe(true)
  })

  it('não confunde com nick maior, e-mail ou texto sem @', () => {
    expect(mentionsUser('@fulano2 oi', 'fulano')).toBe(false)
    expect(mentionsUser('fulano@fulano.com', 'fulano')).toBe(false)
    expect(mentionsUser('fulano sem arroba', 'fulano')).toBe(false)
  })
})

describe('splitMentions', () => {
  it('separa as menções do texto para destacar', () => {
    expect(splitMentions('oi @ana e @bia_2!')).toEqual([
      { text: 'oi ' },
      { text: '@ana', mention: 'ana' },
      { text: ' e ' },
      { text: '@bia_2', mention: 'bia_2' },
      { text: '!' }
    ])
  })

  it('texto sem menção fica inteiro', () => {
    expect(splitMentions('sem nada')).toEqual([{ text: 'sem nada' }])
  })

  it('@all/@here sem mention_everyone ficam como texto puro', () => {
    expect(splitMentions('oi @all e @here')).toEqual([{ text: 'oi @all e @here' }])
    expect(splitMentions('@all @ana', null)).toEqual([
      { text: '@all ' },
      { text: '@ana', mention: 'ana' }
    ])
  })

  it('destaca @all/@here só quando bate com o mention_everyone da mensagem', () => {
    expect(splitMentions('ei @ALL, bora', 'all')).toEqual([
      { text: 'ei ' },
      { text: '@ALL', mention: 'all' },
      { text: ', bora' }
    ])
    expect(splitMentions('@here e @all', 'here')).toEqual([
      { text: '@here', mention: 'here' },
      { text: ' e @all' }
    ])
  })
})

describe('everyonePingsMe', () => {
  it('@all pinga qualquer status', () => {
    for (const status of ['online', 'idle', 'dnd', 'invisible', undefined] as const) {
      expect(everyonePingsMe('all', status)).toBe(true)
    }
  })

  it('@here só pinga quem aparece online (ausente e invisível ficam de fora)', () => {
    expect(everyonePingsMe('here', 'online')).toBe(true)
    expect(everyonePingsMe('here', 'dnd')).toBe(true)
    expect(everyonePingsMe('here', undefined)).toBe(true)
    expect(everyonePingsMe('here', 'idle')).toBe(false)
    expect(everyonePingsMe('here', 'invisible')).toBe(false)
  })

  it('sem mention_everyone, não pinga', () => {
    expect(everyonePingsMe(null, 'online')).toBe(false)
    expect(everyonePingsMe(undefined, 'online')).toBe(false)
  })
})

describe('everyoneSuggestions', () => {
  it('quem pode vê @all e @here, filtrados pelo que foi digitado', () => {
    expect(everyoneSuggestions('', true)).toEqual([
      { username: 'all', description: 'Notifica todos do canal' },
      { username: 'here', description: 'Notifica quem está online' }
    ])
    expect(everyoneSuggestions('H', true)).toEqual([
      { username: 'here', description: 'Notifica quem está online' }
    ])
    expect(everyoneSuggestions('al', true).map((s) => s.username)).toEqual(['all'])
    expect(everyoneSuggestions('ana', true)).toEqual([])
  })

  it('quem não pode não vê nenhuma', () => {
    expect(everyoneSuggestions('', false)).toEqual([])
  })
})

describe('mentionQuery', () => {
  it('detecta o @ sendo digitado antes do cursor', () => {
    expect(mentionQuery('fala @ni', 8)).toEqual({ query: 'ni', start: 5 })
    expect(mentionQuery('@', 1)).toEqual({ query: '', start: 0 })
  })

  it('sem @ logo antes do cursor (ou com espaço no meio), nada', () => {
    expect(mentionQuery('fala ni', 7)).toBeNull()
    expect(mentionQuery('@ana já foi', 11)).toBeNull()
    expect(mentionQuery('email@x', 7)).toBeNull()
  })
})

describe('applyMention', () => {
  it('troca o que foi digitado pelo @nick e um espaço', () => {
    expect(applyMention('fala @ni tudo bem', 5, 8, 'fulano')).toEqual({
      text: 'fala @fulano  tudo bem',
      caret: 13
    })
  })
})

describe('messageMentionsMe', () => {
  const me = { id: 'eu', username: 'fulano' }
  const msg = (
    over: Partial<Parameters<typeof messageMentionsMe>[0]> = {}
  ): Parameters<typeof messageMentionsMe>[0] => ({
    author_id: 'ana',
    content: 'oi',
    reply_to: null,
    mention_everyone: null,
    ...over
  })

  it('@nick, resposta minha e @all/@here liberados destacam a linha', () => {
    expect(messageMentionsMe(msg({ content: 'oi @fulano' }), me)).toBe(true)
    expect(messageMentionsMe(msg({ reply_to: { author_id: 'eu' } }), me)).toBe(true)
    expect(messageMentionsMe(msg({ content: '@all', mention_everyone: 'all' }), me)).toBe(true)
    expect(messageMentionsMe(msg({ content: '@here', mention_everyone: 'here' }), me)).toBe(true)
  })

  it('"@all" sem mention_everyone, mensagem minha ou sem eu logado, não destaca', () => {
    expect(messageMentionsMe(msg({ content: '@all' }), me)).toBe(false)
    expect(
      messageMentionsMe(msg({ author_id: 'eu', content: '@all', mention_everyone: 'all' }), me)
    ).toBe(false)
    expect(messageMentionsMe(msg({ content: '@fulano' }), null)).toBe(false)
  })
})
