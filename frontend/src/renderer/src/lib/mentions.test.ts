import { describe, expect, it } from 'vitest'
import { applyMention, mentionQuery, mentionsUser, splitMentions } from './mentions'

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
