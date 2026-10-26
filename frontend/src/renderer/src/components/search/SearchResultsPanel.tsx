import { useNavigate } from 'react-router-dom'
import type { SearchResult, SearchScope } from '../../api/search'
import {
  highlightParts,
  highlightTerms,
  resultCountLabel,
  SORT_LABELS,
  type SearchSort
} from '../../lib/messageSearch'
import { messagePreview } from '../../lib/polls'
import { serverDisplayName } from '../../lib/serverNames'
import { SEARCH_PAGE_SIZE, searchScopeKey, useSearchStore } from '../../store/searchStore'
import { useServerMemberColor, useServerNicknames } from '../../store/useServerNames'
import Avatar from '../Avatar'
import { HashIcon, SearchIcon, XIcon } from '../icons'

interface SearchResultsPanelProps {
  scope: SearchScope
  /** Canal aberto agora (servidor): resultado de outro canal navega até ele. */
  currentChannelId?: string
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Painel da direita com os resultados da busca do servidor/DM aberto. */
export default function SearchResultsPanel({
  scope,
  currentChannelId
}: SearchResultsPanelProps): React.JSX.Element | null {
  const navigate = useNavigate()
  const activeKey = useSearchStore((s) => (s.scope ? searchScopeKey(s.scope) : null))
  const raw = useSearchStore((s) => s.raw)
  const sort = useSearchStore((s) => s.sort)
  const offset = useSearchStore((s) => s.offset)
  const page = useSearchStore((s) => s.page)
  const loading = useSearchStore((s) => s.loading)
  const error = useSearchStore((s) => s.error)
  const setSort = useSearchStore((s) => s.setSort)
  const goTo = useSearchStore((s) => s.goTo)
  const close = useSearchStore((s) => s.close)
  const requestJump = useSearchStore((s) => s.requestJump)
  const serverId = scope.kind === 'server' ? scope.id : undefined
  const nicknames = useServerNicknames(serverId)

  if (activeKey !== searchScopeKey(scope)) return null

  const terms = highlightTerms(raw)
  const total = page?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE))
  const current = Math.floor(offset / SEARCH_PAGE_SIZE) + 1

  const open = (r: SearchResult): void => {
    if (scope.kind === 'server' && r.channel_id) {
      if (r.channel_id !== currentChannelId) {
        navigate(`/servers/${scope.id}/channels/${r.channel_id}`)
      }
      requestJump(`channel:${r.channel_id}`, r.id)
    } else if (r.conversation_id) {
      requestJump(`conversation:${r.conversation_id}`, r.id)
    }
  }

  return (
    <aside
      aria-label="Resultados da busca"
      className="flex w-80 shrink-0 flex-col border-l border-white/6 bg-[#07080b]/80 xl:w-[26rem]"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/6 px-4 py-3">
        <p className="text-ds-sm font-semibold text-white" aria-live="polite">
          {loading
            ? 'Buscando…'
            : error
              ? 'Busca'
              : resultCountLabel(total, page?.total_capped ?? false)}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Fechar resultados"
          title="Fechar"
          className="cursor-pointer rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div
        role="group"
        aria-label="Ordenar"
        className="flex shrink-0 gap-1 border-b border-white/6 px-3 py-2"
      >
        {(Object.keys(SORT_LABELS) as SearchSort[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={sort === s}
            onClick={() => sort !== s && setSort(s)}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-ds-xs font-medium transition ${
              sort === s
                ? 'bg-[#5865f2]/30 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {SORT_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {error ? (
          <p role="alert" className="px-2 py-8 text-center text-ds-sm text-gray-300">
            {error}
          </p>
        ) : loading && !page ? (
          <p className="px-2 py-8 text-center text-ds-sm text-gray-400">Buscando mensagens…</p>
        ) : page && page.results.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-gray-400">
              <SearchIcon className="h-6 w-6" />
            </span>
            <p className="text-ds-sm font-medium text-gray-200">Nenhum resultado</p>
            <p className="mt-1 text-ds-xs text-gray-400">
              Tente outras palavras ou tire algum filtro.
            </p>
          </div>
        ) : (
          <ul className={`space-y-2 ${loading ? 'opacity-60' : ''}`}>
            {page?.results.map((r) => (
              <li key={r.id}>
                <ResultItem
                  result={r}
                  terms={terms}
                  serverId={serverId}
                  nickname={nicknames?.[r.author_id]}
                  onOpen={() => open(r)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!error && page && pages > 1 && (
        <nav
          aria-label="Páginas dos resultados"
          className="flex shrink-0 items-center justify-between gap-2 border-t border-white/6 px-4 py-2"
        >
          <button
            type="button"
            disabled={current <= 1 || loading}
            onClick={() => goTo(offset - SEARCH_PAGE_SIZE)}
            className="cursor-pointer rounded-md px-2.5 py-1 text-ds-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-ds-xs text-gray-400">
            Página {current} de {pages}
          </span>
          <button
            type="button"
            disabled={current >= pages || loading}
            onClick={() => goTo(offset + SEARCH_PAGE_SIZE)}
            className="cursor-pointer rounded-md px-2.5 py-1 text-ds-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima
          </button>
        </nav>
      )}
    </aside>
  )
}

function ResultItem({
  result,
  terms,
  serverId,
  nickname,
  onOpen
}: {
  result: SearchResult
  terms: string[]
  serverId?: string
  nickname?: string
  onOpen: () => void
}): React.JSX.Element {
  const name = serverDisplayName({ nickname }, result.author, 'Usuário')
  const color = useServerMemberColor(serverId, result.author_id)
  const text = result.content || messagePreview(result)
  const parts = highlightParts(text, result.content ? terms : [])
  const extra = result.content ? messagePreview({ ...result, content: '' }) : ''

  return (
    <button
      type="button"
      onClick={onOpen}
      title="Ir para a mensagem"
      className="group w-full cursor-pointer rounded-lg border border-white/5 bg-[#18191c]/80 p-3 text-left transition hover:border-white/15 hover:bg-[#1f2024] focus-visible:outline-2 focus-visible:outline-[#5865f2]"
    >
      {result.channel_name && (
        <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-gray-400">
          <HashIcon className="h-3 w-3" />
          {result.channel_name}
        </span>
      )}
      <span className="flex items-start gap-2.5">
        <Avatar
          userId={result.author_id}
          name={name}
          avatarUrl={result.author?.avatar_url}
          size={32}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              style={color ? { color } : undefined}
              className={`truncate text-ds-sm font-semibold ${color ? '' : 'text-white'}`}
            >
              {name}
            </span>
            <time dateTime={result.created_at} className="shrink-0 text-[11px] text-gray-500">
              {formatDateTime(result.created_at)}
            </time>
          </span>
          <span className="mt-0.5 line-clamp-6 block whitespace-pre-wrap break-words text-ds-sm text-gray-200">
            {parts.map((p, i) =>
              p.match ? (
                <mark key={i} className="rounded-sm bg-amber-400/30 px-0.5 text-amber-100">
                  {p.text}
                </mark>
              ) : (
                <span key={i}>{p.text}</span>
              )
            )}
          </span>
          {extra && <span className="mt-1 block text-ds-xs text-gray-400">{extra}</span>}
        </span>
      </span>
    </button>
  )
}
