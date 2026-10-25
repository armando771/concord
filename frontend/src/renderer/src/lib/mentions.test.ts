import { describe, expect, it } from 'vitest'
import {
  applyMention,
  everyonePingsMe,
  everyoneSuggestions,
  mentionQuery,
  mentionSuggestions,
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

  it('não conta @nick dentro de link', () => {
    expect(mentionsUser('x.com/@fulano', 'fulano')).toBe(false)
    expect(mentionsUser('https://medium.com/@fulano', 'fulano')).toBe(false)
    expect(mentionsUser('(@fulano)', 'fulano')).toBe(true)
  })

  it('quem se chama all, here ou everyone só é pingado pelo mention_everyone', () => {
    expect(mentionsUser('@all bora', 'all')).toBe(false)
    expect(mentionsUser('@HERE alguém?', 'here')).toBe(false)
    expect(mentionsUser('@everyone', 'Everyone')).toBe(false)
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

  it('@ no meio de link não vira menção, nem com mention_everyone', () => {
    expect(splitMentions('x.com/@all', 'all')).toEqual([{ text: 'x.com/@all' }])
    expect(splitMentions('https://medium.com/@here', 'here')).toEqual([
      { text: 'https://medium.com/@here' }
    ])
    expect(splitMentions('veja x.com/@ana')).toEqual([{ text: 'veja x.com/@ana' }])
    expect(splitMentions('<@all>', 'all')).toEqual([
      { text: '<' },
      { text: '@all', mention: 'all' },
      { text: '>' }
    ])
    expect(splitMentions('["@ana"]')).toEqual([
      { text: '["' },
      { text: '@ana', mention: 'ana' },
      { text: '"]' }
    ])
  })

  it('@everyone não é menção de ninguém', () => {
    expect(splitMentions('oi @everyone')).toEqual([{ text: 'oi @everyone' }])
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

describe('mentionSuggestions', () => {
  const users = [
    { username: 'ana', display_name: 'Ana' },
    { username: 'alice', display_name: 'Alice' },
    { username: 'hugo', display_name: 'Hugo' }
  ]
  const names = (r: ReturnType<typeof mentionSuggestions>): string[] =>
    r.items.map((i) => `${i.kind}:${i.username}`)

  it('só "@": nada de @all/@here, o padrão é a primeira pessoa', () => {
    const r = mentionSuggestions('', users, true)
    expect(names(r)).toEqual(['user:ana', 'user:alice', 'user:hugo'])
    expect(r.defaultIndex).toBe(0)
  })

  it('"@a"/"@h": @all/@here no topo, mas o padrão continua sendo uma pessoa', () => {
    const a = mentionSuggestions('a', users, true)
    expect(names(a)).toEqual(['everyone:all', 'user:ana', 'user:alice'])
    expect(a.defaultIndex).toBe(1)
    const h = mentionSuggestions('H', users, true)
    expect(names(h)).toEqual(['everyone:here', 'user:hugo'])
    expect(h.defaultIndex).toBe(1)
  })

  it('só @all/@here batem: aparecem e o padrão é o que foi digitado', () => {
    const r = mentionSuggestions('al', [{ username: 'bia', display_name: 'Bia' }], true)
    expect(names(r)).toEqual(['everyone:all'])
    expect(r.defaultIndex).toBe(0)
  })

  it('só "@" e ninguém mais bate: @all/@here aparecem, mas sem padrão', () => {
    const r = mentionSuggestions('', [], true)
    expect(names(r)).toEqual(['everyone:all', 'everyone:here'])
    expect(r.defaultIndex).toBe(-1)
  })

  it('sem permissão, só pessoas', () => {
    expect(names(mentionSuggestions('a', users, false))).toEqual(['user:ana', 'user:alice'])
    expect(mentionSuggestions('', [], false)).toEqual({ items: [], defaultIndex: -1 })
  })

  it('esconde eu mesmo e quem se chama all/here/everyone', () => {
    const r = mentionSuggestions(
      '',
      [
        ...users,
        { username: 'All', display_name: 'All' },
        { username: 'everyone', display_name: 'E' }
      ],
      false,
      { exclude: 'ana' }
    )
    expect(names(r)).toEqual(['user:alice', 'user:hugo'])
  })

  it('casa pelo nick ou pelo nome e respeita o limite', () => {
    const r = mentionSuggestions('hu', [{ username: 'x1', display_name: 'Hugo' }], false)
    expect(names(r)).toEqual(['user:x1'])
    expect(mentionSuggestions('', users, false, { max: 2 }).items).toHaveLength(2)
  })
})
