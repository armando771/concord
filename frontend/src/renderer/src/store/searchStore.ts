import { create } from 'zustand'
import { ApiError } from '../api/client'
import { searchMessages, type SearchPage, type SearchScope } from '../api/search'
import {
  isEmptySearch,
  parseSearchQuery,
  searchError,
  searchParams,
  type SearchSort
} from '../lib/messageSearch'

export const SEARCH_PAGE_SIZE = 25

/** Chave do escopo: o painel só aparece no servidor/DM em que a busca foi feita. */
export function searchScopeKey(scope: SearchScope): string {
  return `${scope.kind}:${scope.id}`
}

/** Mensagem do erro da busca, em português. */
export function searchFailureMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Muitas buscas seguidas. Espere um pouco e tente de novo.'
    if (err.status === 400) return 'Não entendi essa busca. Confira os filtros.'
    if (err.status === 404) return 'Você não tem acesso a essas mensagens.'
    if (err.status === 0) return 'Sem conexão com o servidor.'
  }
  return 'Não foi possível buscar agora.'
}

interface SearchState {
  scope: SearchScope | null
  /** O texto buscado (como estava na barra). */
  raw: string
  sort: SearchSort
  offset: number
  page: SearchPage | null
  loading: boolean
  error: string | null
  /** Clique num resultado: a sala abre e o ChatPane rola até a mensagem. */
  pendingJump: { room: string; messageId: string } | null
  run: (
    scope: SearchScope,
    raw: string,
    opts?: { sort?: SearchSort; offset?: number }
  ) => Promise<void>
  setSort: (sort: SearchSort) => void
  goTo: (offset: number) => void
  close: () => void
  requestJump: (room: string, messageId: string) => void
  clearJump: () => void
}

let seq = 0

export const useSearchStore = create<SearchState>((set, get) => ({
  scope: null,
  raw: '',
  sort: 'newest',
  offset: 0,
  page: null,
  loading: false,
  error: null,
  pendingJump: null,

  run: async (scope, raw, opts = {}) => {
    const parsed = parseSearchQuery(raw)
    if (isEmptySearch(parsed)) return
    const sort = opts.sort ?? get().sort
    const offset = opts.offset ?? 0
    const invalid = searchError(parsed)
    const id = ++seq
    set({
      scope,
      raw,
      sort,
      offset,
      error: invalid,
      loading: !invalid,
      page: invalid ? null : get().page
    })
    if (invalid) return
    try {
      const params = searchParams(parsed, {
        sort,
        offset,
        limit: SEARCH_PAGE_SIZE,
        tzOffset: -new Date().getTimezoneOffset(),
        conversation: scope.kind === 'conversation'
      })
      const page = await searchMessages(scope, params)
      if (id !== seq) return
      set({ page, loading: false, error: null })
    } catch (err) {
      if (id !== seq) return
      set({ page: null, loading: false, error: searchFailureMessage(err) })
    }
  },

  setSort: (sort) => {
    const { scope, raw } = get()
    if (scope) void get().run(scope, raw, { sort, offset: 0 })
  },

  goTo: (offset) => {
    const { scope, raw, sort } = get()
    if (scope) void get().run(scope, raw, { sort, offset: Math.max(0, offset) })
  },

  close: () => {
    seq++
    set({ scope: null, raw: '', offset: 0, page: null, loading: false, error: null })
  },

  requestJump: (room, messageId) => set({ pendingJump: { room, messageId } }),
  clearJump: () => set({ pendingJump: null })
}))
