import { describe, expect, it } from 'vitest'
import {
  MAX_NICKNAME,
  nicknameMap,
  normalizeNickname,
  serverDisplayName,
  serverIdFromPath,
  withNickname,
  withServerNames
} from './serverNames'

describe('serverDisplayName', () => {
  const user = { username: 'ana', display_name: 'Ana Souza' }

  it('apelido ganha do nome de exibição, que ganha do @', () => {
    expect(serverDisplayName({ nickname: 'Aninha' }, user)).toBe('Aninha')
    expect(serverDisplayName({ nickname: null }, user)).toBe('Ana Souza')
    expect(serverDisplayName(undefined, user)).toBe('Ana Souza')
    expect(serverDisplayName(null, { username: 'ana', display_name: '' })).toBe('ana')
  })

  it('apelido ou nome vazios (ou só espaço) não contam', () => {
    expect(serverDisplayName({ nickname: '' }, user)).toBe('Ana Souza')
    expect(serverDisplayName({ nickname: '   ' }, user)).toBe('Ana Souza')
    expect(serverDisplayName(null, { username: 'ana', display_name: '  ' })).toBe('ana')
  })

  it('sem nada, usa o padrão (ou o que foi pedido)', () => {
    expect(serverDisplayName(null, null)).toBe('Usuário')
    expect(serverDisplayName({}, {})).toBe('Usuário')
    expect(serverDisplayName(undefined, undefined, 'Membro')).toBe('Membro')
  })

  it('o membro do servidor serve dos dois lados (ele tem nome e @)', () => {
    const member = { user_id: 'u1', username: 'bia', display_name: 'Bia', nickname: 'Bibi' }
    expect(serverDisplayName(member, member)).toBe('Bibi')
  })
})

describe('nicknameMap / withNickname', () => {
  it('só entra quem tem apelido', () => {
    expect(
      nicknameMap([
        { user_id: 'a', nickname: 'Aninha' },
        { user_id: 'b', nickname: null },
        { user_id: 'c' },
        { user_id: 'd', nickname: '' }
      ])
    ).toEqual({ a: 'Aninha' })
  })

  it('troca e tira sem mexer no mapa antigo', () => {
    const before = { a: 'Aninha' }
    const set = withNickname(before, 'b', 'Bibi')
    expect(set).toEqual({ a: 'Aninha', b: 'Bibi' })
    expect(before).toEqual({ a: 'Aninha' })
    expect(withNickname(set, 'a', null)).toEqual({ b: 'Bibi' })
    expect(withNickname(set, 'a', '')).toEqual({ b: 'Bibi' })
  })

  it('sem mudança devolve o mesmo mapa (não re-renderiza à toa)', () => {
    const map = { a: 'Aninha' }
    expect(withNickname(map, 'a', 'Aninha')).toBe(map)
    expect(withNickname(map, 'b', null)).toBe(map)
  })
})

describe('normalizeNickname (mesmas regras do backend)', () => {
  it('tira os espaços das pontas; vazio tira o apelido', () => {
    expect(normalizeNickname('  Aninha ')).toEqual({ ok: true, nickname: 'Aninha' })
    expect(normalizeNickname('')).toEqual({ ok: true, nickname: null })
    expect(normalizeNickname('   ')).toEqual({ ok: true, nickname: null })
  })

  it('recusa invisíveis, controle (NUL incluso) e bidi, como o backend', () => {
    for (const bad of [
      '\u{200b}',
      'a\u{200b}b',
      '\u{3164}',
      '\u{2800}',
      'a\u{202e}b',
      'a\u{2066}b',
      'a\nb',
      '\u{0}',
      '\u{301}'
    ]) {
      expect(normalizeNickname(bad), JSON.stringify(bad)).toEqual({
        ok: false,
        error: 'O apelido não pode ter caracteres invisíveis ou de controle.'
      })
    }
    expect(normalizeNickname('👨\u{200d}👩\u{200d}👧')).toEqual({
      ok: true,
      nickname: '👨\u{200d}👩\u{200d}👧'
    })
  })

  it('até 32 caracteres de verdade (emoji e acento contam um)', () => {
    expect(MAX_NICKNAME).toBe(32)
    expect(normalizeNickname('é'.repeat(32)).ok).toBe(true)
    expect(normalizeNickname('🎮'.repeat(32)).ok).toBe(true)
    const long = normalizeNickname('a'.repeat(33))
    expect(long.ok).toBe(false)
    if (!long.ok) expect(long.error).toBe('O apelido pode ter até 32 caracteres.')
  })
})

describe('serverIdFromPath', () => {
  it('pega o servidor das rotas de servidor', () => {
    expect(serverIdFromPath('/servers/s1')).toBe('s1')
    expect(serverIdFromPath('/servers/s1/channels/c1')).toBe('s1')
  })

  it('DM, amigos e o resto não são de servidor', () => {
    expect(serverIdFromPath('/dm/u1')).toBeNull()
    expect(serverIdFromPath('/friends')).toBeNull()
    expect(serverIdFromPath('/servers')).toBeNull()
    expect(serverIdFromPath('/')).toBeNull()
  })
})

describe('withServerNames (palco, lista da call e overlay)', () => {
  const people = [
    { id: 'a', username: 'ana', display_name: 'Ana' },
    { id: 'b', username: 'bia', display_name: 'Bia' }
  ]

  it('troca o nome de quem tem apelido no servidor da call', () => {
    expect(withServerNames(people, { a: 'Aninha' })).toEqual([
      { id: 'a', username: 'ana', display_name: 'Aninha' },
      { id: 'b', username: 'bia', display_name: 'Bia' }
    ])
  })

  it('call de DM (sem mapa) ou ninguém com apelido: a mesma lista', () => {
    expect(withServerNames(people, undefined)).toBe(people)
    expect(withServerNames(people, { z: 'Zé' })).toBe(people)
  })
})
