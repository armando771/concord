// Busca de mensagens (DMs e servidor), no jeito do Discord: texto livre mais
// filtros "chave:valor". A mesma gramática existe no backend
// (internal/message/search.go): lá ela vale para o q= cru; aqui ela monta a
// barra (sugestões, autocomplete), valida antes de enviar, vira os
// parâmetros da URL e destaca o termo nos resultados.

export type SearchFilterKey =
  'from' | 'in' | 'has' | 'mentions' | 'before' | 'after' | 'during' | 'authorType' | 'pinned'

export type HasKind = 'link' | 'image' | 'video' | 'audio' | 'file' | 'poll'

export type SearchSort = 'newest' | 'oldest' | 'relevance'

export interface ParsedSearch {
  terms: string[]
  from: string[]
  in: string[]
  has: string[]
  mentions: string[]
  before?: string
  after?: string
  during?: string
  authorType?: string
  pinned?: string
}

/** Chave digitada (minúscula) -> chave canônica. */
const KEYS: Record<string, SearchFilterKey> = {
  from: 'from',
  in: 'in',
  has: 'has',
  mentions: 'mentions',
  before: 'before',
  after: 'after',
  during: 'during',
  authortype: 'authorType',
  author_type: 'authorType',
  pinned: 'pinned'
}

export function filterKeyOf(raw: string): SearchFilterKey | null {
  return KEYS[raw.toLowerCase()] ?? null
}

/** Pedaço do texto: [start, end) no original. */
export interface SearchToken {
  text: string
  start: number
  end: number
}

/**
 * Quebra o texto em palavras, respeitando aspas: "bom dia" é um termo só e
 * in:"sala de jogos" é um filtro só. Aspas sem par vão até o fim.
 */
export function splitSearchTokens(raw: string): SearchToken[] {
  const tokens: SearchToken[] = []
  let start = -1
  let inQuote = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '"') {
      inQuote = !inQuote
      if (start < 0) start = i
    } else if (/\s/.test(ch) && !inQuote) {
      if (start >= 0) {
        tokens.push({ text: raw.slice(start, i), start, end: i })
        start = -1
      }
    } else if (start < 0) {
      start = i
    }
  }
  if (start >= 0) tokens.push({ text: raw.slice(start), start, end: raw.length })
  return tokens
}

const unquote = (s: string): string => s.replace(/"/g, '').trim()

/** Separa o token em chave de filtro e valor (null = texto livre). */
function splitFilter(token: string): { key: SearchFilterKey; value: string } | null {
  const colon = token.indexOf(':')
  if (colon < 0) return null
  const rawKey = token.slice(0, colon)
  if (rawKey.includes('"')) return null
  const key = filterKeyOf(rawKey)
  if (!key) return null
  return { key, value: unquote(token.slice(colon + 1)) }
}

/**
 * Separa o texto da barra em termos e filtros. Chave desconhecida
 * ("https://", "obs:") é texto; filtro sem valor ("from:") é ignorado.
 */
export function parseSearchQuery(raw: string): ParsedSearch {
  const q: ParsedSearch = { terms: [], from: [], in: [], has: [], mentions: [] }
  for (const tok of splitSearchTokens(raw)) {
    const filter = splitFilter(tok.text)
    if (!filter) {
      const term = unquote(tok.text)
      if (term) q.terms.push(term)
      continue
    }
    const { key, value } = filter
    if (!value) continue
    switch (key) {
      case 'from':
        q.from.push(value.replace(/^@/, ''))
        break
      case 'in':
        q.in.push(value.replace(/^#/, ''))
        break
      case 'has':
        q.has.push(value)
        break
      case 'mentions':
        q.mentions.push(value.replace(/^@/, ''))
        break
      default:
        q[key] = value
    }
  }
  return q
}

/** Sem texto e sem filtro: nada para buscar. */
export function isEmptySearch(q: ParsedSearch): boolean {
  return (
    q.terms.length === 0 &&
    q.from.length === 0 &&
    q.in.length === 0 &&
    q.has.length === 0 &&
    q.mentions.length === 0 &&
    !q.before &&
    !q.after &&
    !q.during &&
    !q.authorType &&
    !q.pinned
  )
}

/** Tira acento e maiúscula (o mesmo que o search_normalize do banco). */
export function foldSearchText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

const HAS_ALIASES: Record<string, HasKind> = {
  link: 'link',
  links: 'link',
  embed: 'link',
  image: 'image',
  imagem: 'image',
  imagens: 'image',
  foto: 'image',
  video: 'video',
  videos: 'video',
  audio: 'audio',
  audios: 'audio',
  file: 'file',
  arquivo: 'file',
  arquivos: 'file',
  anexo: 'file',
  poll: 'poll',
  enquete: 'poll',
  enquetes: 'poll'
}

export function normalizeHas(value: string): HasKind | null {
  return HAS_ALIASES[foldSearchText(value)] ?? null
}

/** Valores do has: na ordem das sugestões (com o nome em português). */
export const HAS_OPTIONS: { value: string; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'imagem', label: 'Imagem' },
  { value: 'vídeo', label: 'Vídeo' },
  { value: 'áudio', label: 'Áudio' },
  { value: 'arquivo', label: 'Arquivo (qualquer anexo)' },
  { value: 'enquete', label: 'Enquete' }
]

export function normalizeAuthorType(value: string): 'user' | 'bot' | null {
  const v = foldSearchText(value)
  if (['user', 'usuario', 'pessoa', 'humano'].includes(v)) return 'user'
  if (['bot', 'bots'].includes(v)) return 'bot'
  return null
}

export function normalizePinned(value: string): boolean | null {
  const v = foldSearchText(value)
  if (['true', 'sim', 'yes', '1'].includes(v)) return true
  if (['false', 'nao', 'no', '0'].includes(v)) return false
  return null
}

/** Lê "AAAA-MM-DD" ou "DD/MM/AAAA" (null se não for uma data de verdade). */
export function parseSearchDate(value: string): { y: number; m: number; d: number } | null {
  let y: number, m: number, d: number
  let g = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value)
  if (g) {
    ;[y, m, d] = [Number(g[1]), Number(g[2]), Number(g[3])]
  } else {
    g = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
    if (!g) return null
    ;[d, m, y] = [Number(g[1]), Number(g[2]), Number(g[3])]
  }
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  if (y < 2000) return null
  return { y, m, d }
}

/** Data de hoje (no fuso da pessoa) em AAAA-MM-DD, para sugerir. */
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const USERNAME = /^[A-Za-z0-9_]{1,32}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** O que está errado na busca, para mostrar antes de enviar (null = ok). */
export function searchError(q: ParsedSearch): string | null {
  for (const v of q.from) {
    if (!USERNAME.test(v) && !UUID.test(v)) return `Usuário inválido em from: "${v}".`
  }
  for (const v of q.mentions) {
    if (!USERNAME.test(v)) return `Usuário inválido em mentions: "${v}".`
  }
  for (const v of q.has) {
    if (!normalizeHas(v)) {
      return `has: aceita link, imagem, vídeo, áudio, arquivo ou enquete (não "${v}").`
    }
  }
  for (const key of ['before', 'after', 'during'] as const) {
    const v = q[key]
    if (v && !parseSearchDate(v)) return `Data inválida em ${key}: use AAAA-MM-DD ou DD/MM/AAAA.`
  }
  if (q.authorType && !normalizeAuthorType(q.authorType)) {
    return 'authorType: aceita user ou bot.'
  }
  if (q.pinned && normalizePinned(q.pinned) === null) return 'pinned: aceita sim ou não.'
  if (q.terms.length > 10) return 'Use no máximo 10 palavras na busca.'
  return null
}

/** Termo com espaço volta entre aspas (para o q= ser lido igual no backend). */
function quoteTerm(term: string): string {
  return /\s/.test(term) ? `"${term}"` : term
}

export interface SearchRequest {
  sort?: SearchSort
  offset?: number
  limit?: number
  /** Minutos a leste de UTC (-180 em Brasília): o dia das datas é o da pessoa. */
  tzOffset?: number
  /** Numa DM não existe in: nem pinned: (fixar é só em canal). */
  conversation?: boolean
}

/** Os parâmetros da URL da busca: texto em q= e cada filtro no seu. */
export function searchParams(q: ParsedSearch, req: SearchRequest = {}): URLSearchParams {
  const p = new URLSearchParams()
  if (q.terms.length) p.set('q', q.terms.map(quoteTerm).join(' '))
  for (const v of q.from) p.append('from', v)
  if (!req.conversation) for (const v of q.in) p.append('in', v)
  for (const v of q.has) p.append('has', v)
  for (const v of q.mentions) p.append('mentions', v)
  if (q.before) p.set('before', q.before)
  if (q.after) p.set('after', q.after)
  if (q.during) p.set('during', q.during)
  if (q.authorType) p.set('author_type', q.authorType)
  if (q.pinned && !req.conversation) p.set('pinned', q.pinned)
  if (req.sort && req.sort !== 'newest') p.set('sort', req.sort)
  if (req.offset) p.set('offset', String(req.offset))
  if (req.limit) p.set('limit', String(req.limit))
  if (req.tzOffset !== undefined && (q.before || q.after || q.during)) {
    p.set('tz_offset', String(req.tzOffset))
  }
  return p
}

// ---------------------------------------------------------------------------
// Sugestões da barra

export interface FilterOption {
  key: SearchFilterKey
  /** O que entra na barra ao escolher (ex.: "from:"). */
  insert: string
  title: string
  hint: string
  /** Só em servidor (in: e pinned:). */
  serverOnly?: boolean
  /** Fica em "Mais filtros". */
  more?: boolean
}

export const FILTER_OPTIONS: FilterOption[] = [
  { key: 'from', insert: 'from:', title: 'De um usuário específico', hint: 'from: usuário' },
  {
    key: 'in',
    insert: 'in:',
    title: 'Enviada em um canal específico',
    hint: 'in: canal',
    serverOnly: true
  },
  {
    key: 'has',
    insert: 'has:',
    title: 'Inclui um tipo de conteúdo',
    hint: 'has: link, imagem, vídeo, áudio, arquivo ou enquete'
  },
  { key: 'mentions', insert: 'mentions:', title: 'Menciona um usuário', hint: 'mentions: usuário' },
  {
    key: 'before',
    insert: 'before:',
    title: 'Antes de uma data',
    hint: 'before: AAAA-MM-DD',
    more: true
  },
  {
    key: 'after',
    insert: 'after:',
    title: 'Depois de uma data',
    hint: 'after: AAAA-MM-DD',
    more: true
  },
  {
    key: 'during',
    insert: 'during:',
    title: 'Em uma data',
    hint: 'during: AAAA-MM-DD',
    more: true
  },
  {
    key: 'authorType',
    insert: 'authorType:',
    title: 'Tipo de autor',
    hint: 'authorType: user ou bot',
    more: true
  },
  {
    key: 'pinned',
    insert: 'pinned:',
    title: 'Mensagens fixadas',
    hint: 'pinned: sim ou não',
    serverOnly: true,
    more: true
  }
]

/** Os filtros que valem aqui (numa DM, sem in: e pinned:). */
export function filterOptionsFor(isServer: boolean): FilterOption[] {
  return FILTER_OPTIONS.filter((f) => isServer || !f.serverOnly)
}

/**
 * O token em que o cursor está (o que a pessoa está digitando agora). Com o
 * cursor logo depois de um espaço, é um token vazio naquele ponto.
 */
export function tokenAtCaret(raw: string, caret: number): SearchToken {
  for (const tok of splitSearchTokens(raw)) {
    if (caret >= tok.start && caret <= tok.end) return tok
  }
  return { text: '', start: caret, end: caret }
}

export interface SearchUser {
  id: string
  username: string
  displayName: string
  nickname?: string | null
  avatarUrl?: string | null
}

export interface SearchChannel {
  id: string
  name: string
}

export type Suggestion =
  | { kind: 'filter'; option: FilterOption }
  | { kind: 'user'; key: 'from' | 'mentions'; user: SearchUser }
  | { kind: 'channel'; channel: SearchChannel }
  | { kind: 'value'; key: SearchFilterKey; value: string; label: string }

export interface SuggestionContext {
  isServer: boolean
  users: SearchUser[]
  channels: SearchChannel[]
  /** Mostra os filtros de "Mais filtros". */
  showMore?: boolean
  now?: Date
  max?: number
}

/**
 * O que oferecer no menu para o token sob o cursor: a lista de filtros
 * (token sem chave), ou os valores do filtro que está sendo digitado
 * (pessoas, canais, tipos, datas).
 */
export function searchSuggestions(token: SearchToken, ctx: SuggestionContext): Suggestion[] {
  const max = ctx.max ?? 8
  const filter = splitFilter(token.text)
  if (!filter) {
    const typed = token.text.toLowerCase()
    return filterOptionsFor(ctx.isServer)
      .filter((o) => (typed ? o.insert.toLowerCase().startsWith(typed) : !o.more || ctx.showMore))
      .map((option) => ({ kind: 'filter', option }))
  }
  const value = foldSearchText(filter.value.replace(/^[@#]/, ''))
  switch (filter.key) {
    case 'from':
    case 'mentions': {
      const key = filter.key
      return ctx.users
        .filter((u) =>
          [u.username, u.displayName, u.nickname ?? ''].some((n) =>
            foldSearchText(n).includes(value)
          )
        )
        .sort((a, b) => {
          // Quem começa com o que foi digitado vem antes.
          const starts = (u: SearchUser): number =>
            foldSearchText(u.username).startsWith(value) ? 0 : 1
          return starts(a) - starts(b) || a.username.localeCompare(b.username)
        })
        .slice(0, max)
        .map((user) => ({ kind: 'user', key, user }))
    }
    case 'in':
      if (!ctx.isServer) return []
      return ctx.channels
        .filter((c) => foldSearchText(c.name).includes(value))
        .slice(0, max)
        .map((channel) => ({ kind: 'channel', channel }))
    case 'has':
      return HAS_OPTIONS.filter((o) => foldSearchText(o.value).startsWith(value)).map((o) => ({
        kind: 'value',
        key: 'has',
        value: o.value,
        label: o.label
      }))
    case 'before':
    case 'after':
    case 'during': {
      const today = todayISO(ctx.now)
      return today.startsWith(filter.value) || !filter.value
        ? [{ kind: 'value', key: filter.key, value: today, label: `Hoje (${today})` }]
        : []
    }
    case 'authorType':
      return [
        { kind: 'value', key: 'authorType', value: 'user', label: 'Pessoas' },
        { kind: 'value', key: 'authorType', value: 'bot', label: 'Bots' }
      ].filter((o) => o.value.startsWith(value)) as Suggestion[]
    case 'pinned':
      return [
        { kind: 'value', key: 'pinned', value: 'sim', label: 'Só as fixadas' },
        { kind: 'value', key: 'pinned', value: 'não', label: 'Só as não fixadas' }
      ].filter((o) => foldSearchText(o.value).startsWith(value)) as Suggestion[]
  }
  return []
}

/** Valor com espaço entra entre aspas (in:"sala de jogos"). */
function quoteValue(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value
}

/** O texto que a sugestão põe no lugar do token. */
export function suggestionText(s: Suggestion): string {
  switch (s.kind) {
    case 'filter':
      return s.option.insert
    case 'user':
      return `${s.key}:${s.user.username}`
    case 'channel':
      return `in:${quoteValue(s.channel.name)}`
    case 'value':
      return `${s.key}:${quoteValue(s.value)}`
  }
}

/**
 * Troca o token pela sugestão. Um filtro só com a chave ("from:") fica colado
 * para a pessoa digitar o valor; um completo ganha um espaço depois.
 */
export function applySuggestion(
  raw: string,
  token: SearchToken,
  s: Suggestion
): { text: string; caret: number } {
  const insert = suggestionText(s)
  const complete = s.kind !== 'filter'
  const after = raw.slice(token.end)
  const glue = complete && !after.startsWith(' ') ? ' ' : ''
  const text = raw.slice(0, token.start) + insert + glue + after
  const caret = token.start + insert.length + (complete ? 1 : 0)
  return { text, caret }
}

// ---------------------------------------------------------------------------
// Resultados

export interface HighlightPart {
  text: string
  match: boolean
}

/**
 * Divide o texto em pedaços, marcando onde os termos aparecem (sem acento nem
 * maiúscula, como a busca). Pedaços que se encostam viram um só.
 */
export function highlightParts(content: string, terms: string[]): HighlightPart[] {
  const wanted = terms.map(foldSearchText).filter((t) => t.length > 0)
  if (!content) return []
  if (wanted.length === 0) return [{ text: content, match: false }]

  // Texto dobrado com o índice de cada caractere no original.
  let folded = ''
  const origin: number[] = []
  for (let i = 0; i < content.length;) {
    const cp = content.codePointAt(i) ?? 0
    const ch = String.fromCodePoint(cp)
    const f = foldSearchText(ch)
    for (let k = 0; k < f.length; k++) origin.push(i)
    folded += f
    i += ch.length
  }
  origin.push(content.length)

  const marked = new Array<boolean>(content.length).fill(false)
  for (const term of wanted) {
    for (let at = folded.indexOf(term); at >= 0; at = folded.indexOf(term, at + 1)) {
      const from = origin[at]
      const lastIdx = origin[at + term.length - 1]
      const lastCp = content.codePointAt(lastIdx) ?? 0
      const to = lastIdx + String.fromCodePoint(lastCp).length
      for (let i = from; i < to; i++) marked[i] = true
    }
  }

  const parts: HighlightPart[] = []
  for (let i = 0; i < content.length; i++) {
    const last = parts[parts.length - 1]
    if (last && last.match === marked[i]) last.text += content[i]
    else parts.push({ text: content[i], match: marked[i] })
  }
  return parts
}

/** Termos para destacar: só o texto livre (filtros não aparecem no texto). */
export function highlightTerms(raw: string): string[] {
  return parseSearchQuery(raw).terms
}

/** "1 resultado", "25 resultados", "1000+ resultados". */
export function resultCountLabel(total: number, capped: boolean): string {
  if (capped) return `${total}+ resultados`
  return total === 1 ? '1 resultado' : `${total} resultados`
}

export const SORT_LABELS: Record<SearchSort, string> = {
  newest: 'Mais recentes',
  oldest: 'Mais antigas',
  relevance: 'Relevância'
}
