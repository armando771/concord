import { describe, expect, it } from 'vitest'
import { MAX_HOVER_AVATARS, summarizeVoicePeople, voicePeopleLabel } from './serverHoverCard'

const people = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i}`, name: `Pessoa ${i}`, avatarUrl: null }))

describe('summarizeVoicePeople', () => {
  it('sem ninguém não mostra avatares nem contador', () => {
    expect(summarizeVoicePeople([])).toEqual({ visible: [], extra: 0 })
  })

  it('até o limite mostra todo mundo, sem contador', () => {
    const r = summarizeVoicePeople(people(MAX_HOVER_AVATARS))
    expect(r.visible).toHaveLength(MAX_HOVER_AVATARS)
    expect(r.extra).toBe(0)
  })

  it('passou do limite: corta nos primeiros e conta o resto', () => {
    const r = summarizeVoicePeople(people(8))
    expect(r.visible.map((p) => p.id)).toEqual(['u0', 'u1', 'u2', 'u3', 'u4'])
    expect(r.extra).toBe(3)
  })

  it('aceita um limite diferente', () => {
    expect(summarizeVoicePeople(people(4), 2)).toMatchObject({ extra: 2 })
  })
})

describe('voicePeopleLabel', () => {
  it('lista os nomes para leitores de tela', () => {
    expect(voicePeopleLabel(people(2))).toBe('Em call: Pessoa 0, Pessoa 1')
  })
})
