import { describe, expect, it } from 'vitest'
import {
  applySuggestion,
  foldSearchText,
  highlightParts,
  isEmptySearch,
  normalizeHas,
  parseSearchDate,
  parseSearchQuery,
  resultCountLabel,
  searchError,
  searchParams,
  searchSuggestions,
  tokenAtCaret,
  type SearchUser,
  type Suggestion
} from './messageSearch'

describe('parseSearchQuery', () => {
  it('separa texto e filtros (mesmos casos do backend)', () => {
    expect(parseSearchQuery('from:ana oi')).toEqual({
      terms: ['oi'],
      from: ['ana'],
      in: [],
      has: [],
      mentions: []
    })
    const q = parseSearchQuery(
      'FROM:@Ana in:#geral in:"sala de jogos" has:link mentions:@bia "bom dia" before:2026-01-02 after:2025-12-01 during:2025-12-25 authorType:bot pinned:true'
    )
    expect(q.from).toEqual(['Ana'])
    expect(q.in).toEqual(['geral', 'sala de jogos'])
    expect(q.has).toEqual(['link'])
    expect(q.mentions).toEqual(['bia'])
    expect(q.terms).toEqual(['bom dia'])
    expect(q).toMatchObject({
      before: '2026-01-02',
      after: '2025-12-01',
      during: '2025-12-25',
      authorType: 'bot',
      pinned: 'true'
    })
  })

  it('chave desconhecida é texto e filtro sem valor some', () => {
    expect(parseSearchQuery('https://x.com obs:nada').terms).toEqual(['https://x.com', 'obs:nada'])
    expect(parseSearchQuery('from: oi')).toMatchObject({ terms: ['oi'], from: [] })
    expect(parseSearchQuery('author_type:user').authorType).toBe('user')
    expect(parseSearchQuery('"sem fim de aspas').terms).toEqual(['sem fim de aspas'])
    expect(parseSearchQuery('  muitos   espaços\t').terms).toEqual(['muitos', 'espaços'])
  })

  it('vazio sem texto nem filtro', () => {
    expect(isEmptySearch(parseSearchQuery('   from:  '))).toBe(true)
    expect(isEmptySearch(parseSearchQuery('has:link'))).toBe(false)
    expect(isEmptySearch(parseSearchQuery('pinned:sim'))).toBe(false)
  })
})

describe('validação', () => {
  it('has: aceita português e inglês', () => {
    expect(normalizeHas('Vídeo')).toBe('video')
    expect(normalizeHas('embed')).toBe('link')
    expect(normalizeHas('arquivo')).toBe('file')
    expect(normalizeHas('enquete')).toBe('poll')
    expect(normalizeHas('holograma')).toBeNull()
  })

  it('datas de verdade, nos dois formatos', () => {
    expect(parseSearchDate('2026-03-10')).toEqual({ y: 2026, m: 3, d: 10 })
    expect(parseSearchDate('10/03/2026')).toEqual({ y: 2026, m: 3, d: 10 })
    expect(parseSearchDate('2026-02-30')).toBeNull()
    expect(parseSearchDate('ontem')).toBeNull()
    expect(parseSearchDate('1999-01-01')).toBeNull()
  })

  it('mensagens de erro em português', () => {
    expect(searchError(parseSearchQuery('oi from:ana has:imagem'))).toBeNull()
    expect(searchError(parseSearchQuery('has:gif'))).toContain('has:')
    expect(searchError(parseSearchQuery('before:amanhã'))).toContain('Data inválida')
    expect(searchError(parseSearchQuery('authorType:alien'))).toContain('authorType')
    expect(searchError(parseSearchQuery('pinned:talvez'))).toContain('pinned')
    expect(searchError(parseSearchQuery('from:"ana maria"'))).toContain('from:')
  })
})

describe('searchParams', () => {
  it('cada filtro no seu parâmetro', () => {
    const p = searchParams(
      parseSearchQuery(
        '"bom dia" oi from:ana from:bia in:geral has:link before:2026-01-01 pinned:sim'
      ),
      {
        sort: 'relevance',
        offset: 25,
        tzOffset: -180
      }
    )
    expect(p.get('q')).toBe('"bom dia" oi')
    expect(p.getAll('from')).toEqual(['ana', 'bia'])
    expect(p.get('in')).toBe('geral')
    expect(p.get('has')).toBe('link')
    expect(p.get('before')).toBe('2026-01-01')
    expect(p.get('pinned')).toBe('sim')
    expect(p.get('sort')).toBe('relevance')
    expect(p.get('offset')).toBe('25')
    expect(p.get('tz_offset')).toBe('-180')
  })

  it('numa DM não manda in: nem pinned:; sem data, sem fuso', () => {
    const p = searchParams(parseSearchQuery('oi in:geral pinned:sim'), {
      conversation: true,
      tzOffset: -180
    })
    expect(p.has('in')).toBe(false)
    expect(p.has('pinned')).toBe(false)
    expect(p.has('tz_offset')).toBe(false)
    expect(p.has('sort')).toBe(false)
  })
})

const users: SearchUser[] = [
  { id: '1', username: 'ana', displayName: 'Ana Júlia' },
  { id: '2', username: 'bia', displayName: 'Beatriz', nickname: 'Bibi' },
  { id: '3', username: 'joana', displayName: 'Jô' }
]
const channels = [
  { id: 'c1', name: 'geral' },
  { id: 'c2', name: 'sala de jogos' }
]

describe('sugestões', () => {
  const ctx = { isServer: true, users, channels }

  it('token vazio: os filtros principais (DM sem in:)', () => {
    const keys = (s: Suggestion[]): string[] =>
      s.map((x) => (x.kind === 'filter' ? x.option.key : x.kind))
    expect(keys(searchSuggestions(tokenAtCaret('', 0), ctx))).toEqual([
      'from',
      'in',
      'has',
      'mentions'
    ])
    expect(keys(searchSuggestions(tokenAtCaret('', 0), { ...ctx, isServer: false }))).toEqual([
      'from',
      'has',
      'mentions'
    ])
    expect(keys(searchSuggestions(tokenAtCaret('', 0), { ...ctx, showMore: true }))).toContain(
      'pinned'
    )
    // Começo da chave filtra (inclusive os de "Mais filtros").
    expect(keys(searchSuggestions(tokenAtCaret('oi be', 5), ctx))).toEqual(['before'])
  })

  it('from: e mentions: sugerem pessoas pelo @, nome ou apelido, sem acento', () => {
    const names = (raw: string): string[] =>
      searchSuggestions(tokenAtCaret(raw, raw.length), ctx).map((s) =>
        s.kind === 'user' ? s.user.username : '?'
      )
    expect(names('from:an')).toEqual(['ana', 'joana'])
    expect(names('from:julia')).toEqual(['ana'])
    expect(names('mentions:@bibi')).toEqual(['bia'])
  })

  it('in: sugere canais (só em servidor) e has:, os tipos', () => {
    const s = searchSuggestions(tokenAtCaret('in:jog', 6), ctx)
    expect(s).toEqual([{ kind: 'channel', channel: channels[1] }])
    expect(searchSuggestions(tokenAtCaret('in:', 3), { ...ctx, isServer: false })).toEqual([])
    const has = searchSuggestions(tokenAtCaret('has:vi', 6), ctx)
    expect(has.map((x) => (x.kind === 'value' ? x.value : ''))).toEqual(['vídeo'])
  })

  it('datas sugerem hoje', () => {
    const now = new Date(2026, 2, 5, 15, 0)
    const s = searchSuggestions(tokenAtCaret('before:', 7), { ...ctx, now })
    expect(s).toEqual([
      { kind: 'value', key: 'before', value: '2026-03-05', label: 'Hoje (2026-03-05)' }
    ])
  })

  it('aplicar troca só o token do cursor', () => {
    const raw = 'oi fr tchau'
    const tok = tokenAtCaret(raw, 5)
    expect(tok).toEqual({ text: 'fr', start: 3, end: 5 })
    const filter = searchSuggestions(tok, ctx)[0]
    expect(applySuggestion(raw, tok, filter)).toEqual({ text: 'oi from: tchau', caret: 8 })

    const raw2 = 'oi from:an'
    const tok2 = tokenAtCaret(raw2, raw2.length)
    const user = searchSuggestions(tok2, ctx)[0]
    expect(applySuggestion(raw2, tok2, user)).toEqual({ text: 'oi from:ana ', caret: 12 })

    const raw3 = 'in:sa'
    const tok3 = tokenAtCaret(raw3, 5)
    expect(applySuggestion(raw3, tok3, searchSuggestions(tok3, ctx)[0]).text).toBe(
      'in:"sala de jogos" '
    )
  })

  it('cursor depois de espaço é um token novo', () => {
    expect(tokenAtCaret('oi ', 3)).toEqual({ text: '', start: 3, end: 3 })
    expect(tokenAtCaret('in:"sala de', 8).text).toBe('in:"sala de')
  })
})

describe('highlightParts', () => {
  it('marca o termo sem acento nem maiúscula, mantendo o texto original', () => {
    expect(highlightParts('Olá, ola e OLÁ', ['ola'])).toEqual([
      { text: 'Olá', match: true },
      { text: ', ', match: false },
      { text: 'ola', match: true },
      { text: ' e ', match: false },
      { text: 'OLÁ', match: true }
    ])
    expect(foldSearchText('Ação')).toBe('acao')
  })

  it('junta termos que se encostam e respeita emoji', () => {
    expect(highlightParts('bom dia 😀 jogando', ['bom', ' dia', 'jog'])).toEqual([
      { text: 'bom dia', match: true },
      { text: ' 😀 ', match: false },
      { text: 'jog', match: true },
      { text: 'ando', match: false }
    ])
    expect(highlightParts('nada aqui', [])).toEqual([{ text: 'nada aqui', match: false }])
    expect(highlightParts('', ['x'])).toEqual([])
  })
})

it('resultCountLabel', () => {
  expect(resultCountLabel(1, false)).toBe('1 resultado')
  expect(resultCountLabel(25, false)).toBe('25 resultados')
  expect(resultCountLabel(1000, true)).toBe('1000+ resultados')
})
