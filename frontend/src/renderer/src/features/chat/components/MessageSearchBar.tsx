import { useEffect, useId, useRef, useState } from 'react'
import type { SearchScope } from '../api/search'
import {
  applySuggestion,
  isEmptySearch,
  parseSearchQuery,
  searchSuggestions,
  tokenAtCaret,
  type FilterOption,
  type SearchChannel,
  type SearchUser,
  type Suggestion
} from '../lib/messageSearch'
import { searchScopeKey, useSearchStore } from '../store/searchStore'
import Avatar from '../../../shared/ui/Avatar'
import {
  AtIcon,
  CalendarIcon,
  HashIcon,
  PaperclipIcon,
  PinIcon,
  SearchIcon,
  SlidersIcon,
  UserIcon,
  XIcon
} from '../../../shared/ui/icons'

interface MessageSearchBarProps {
  scope: SearchScope
  /** Nome da DM, do grupo ou do servidor ("Buscar em …"). */
  name: string
  users: SearchUser[]
  channels?: SearchChannel[]
}

const FILTER_ICON: Record<FilterOption['key'], (p: { className?: string }) => React.JSX.Element> = {
  from: UserIcon,
  in: HashIcon,
  has: PaperclipIcon,
  mentions: AtIcon,
  before: CalendarIcon,
  after: CalendarIcon,
  during: CalendarIcon,
  authorType: UserIcon,
  pinned: PinIcon
}

/** Item do menu: uma sugestão ou o "Mais filtros". */
type MenuItem = { kind: 'more' } | Suggestion

function itemKey(item: MenuItem, i: number): string {
  switch (item.kind) {
    case 'more':
      return 'more'
    case 'filter':
      return `f-${item.option.key}`
    case 'user':
      return `u-${item.user.id}`
    case 'channel':
      return `c-${item.channel.id}`
    case 'value':
      return `v-${item.key}-${item.value}-${i}`
  }
}

/**
 * Barra de busca do topo (DM, grupo ou servidor), como a do Discord: digitar
 * abre o menu de filtros; com um filtro começado, ele sugere pessoas, canais,
 * tipos e datas. Enter busca e abre os resultados no painel da direita.
 */
export default function MessageSearchBar({
  scope,
  name,
  users,
  channels = []
}: MessageSearchBarProps): React.JSX.Element {
  const key = searchScopeKey(scope)
  const isServer = scope.kind === 'server'
  const run = useSearchStore((s) => s.run)
  const close = useSearchStore((s) => s.close)
  const activeKey = useSearchStore((s) => (s.scope ? searchScopeKey(s.scope) : null))
  const activeRaw = useSearchStore((s) => s.raw)

  const [text, setText] = useState(() => (activeKey === key ? activeRaw : ''))
  const [caret, setCaret] = useState(0)
  const [focused, setFocused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  // Trocou de servidor/DM: a barra começa vazia (ou com a busca desse lugar).
  const [shownKey, setShownKey] = useState(key)
  if (shownKey !== key) {
    setShownKey(key)
    setText(activeKey === key ? activeRaw : '')
    setMenuOpen(false)
    setShowMore(false)
  }

  // Ctrl+F (Cmd+F) foca a busca, como no Discord.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const token = tokenAtCaret(text, caret)
  const suggestions = menuOpen
    ? searchSuggestions(token, { isServer, users, channels, showMore })
    : []
  const showingFilters = suggestions.length > 0 && suggestions.every((s) => s.kind === 'filter')
  const items: MenuItem[] =
    showingFilters && !token.text && !showMore ? [...suggestions, { kind: 'more' }] : suggestions
  const open = menuOpen && focused && items.length > 0
  const active = activeIndex >= 0 && activeIndex < items.length ? activeIndex : -1

  const syncCaret = (): void => setCaret(inputRef.current?.selectionStart ?? text.length)

  const submit = (): void => {
    const parsed = parseSearchQuery(text)
    if (isEmptySearch(parsed)) return
    setMenuOpen(false)
    void run(scope, text.trim(), { offset: 0 })
  }

  const choose = (item: MenuItem): void => {
    if (item.kind === 'more') {
      setShowMore(true)
      setActiveIndex(-1)
      return
    }
    const next = applySuggestion(text, token, item)
    setText(next.text)
    setCaret(next.caret)
    setActiveIndex(-1)
    setMenuOpen(true)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  const clear = (): void => {
    setText('')
    setCaret(0)
    setShowMore(false)
    if (activeKey === key) close()
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open) {
        setMenuOpen(true)
        return
      }
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex(
        (active + step + items.length + (active < 0 && step < 0 ? 1 : 0)) % items.length
      )
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && active >= 0) choose(items[active])
      else submit()
      return
    }
    if (e.key === 'Tab' && open && token.text) {
      e.preventDefault()
      choose(items[active >= 0 ? active : 0])
      return
    }
    if (e.key === 'Escape') {
      if (open) {
        setMenuOpen(false)
      } else if (text) {
        clear()
      } else {
        if (activeKey === key) close()
        inputRef.current?.blur()
      }
    }
  }

  const sectionTitle = (): string => {
    const first = items[0]
    if (!first || first.kind === 'filter' || first.kind === 'more') return 'Filtros'
    if (first.kind === 'user') return first.key === 'from' ? 'De' : 'Menciona'
    if (first.kind === 'channel') return 'Canais'
    return 'Opções'
  }

  const placeholder = `Buscar em ${name}`

  return (
    <div className="relative">
      <div
        className={`flex h-8 items-center gap-1.5 rounded-lg border bg-input px-2 transition-[width,border-color] ${
          focused || text ? 'w-72 border-brand/60' : 'w-52 border-subtle'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={placeholder}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          placeholder={placeholder}
          value={text}
          maxLength={500}
          onChange={(e) => {
            setText(e.target.value)
            setCaret(e.target.selectionStart ?? e.target.value.length)
            setMenuOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => {
            setFocused(true)
            setMenuOpen(true)
            syncCaret()
          }}
          onBlur={() => {
            setFocused(false)
            setShowMore(false)
          }}
          onClick={syncCaret}
          onKeyUp={(e) => {
            if (
              e.key === 'ArrowLeft' ||
              e.key === 'ArrowRight' ||
              e.key === 'Home' ||
              e.key === 'End'
            ) {
              syncCaret()
            }
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-ds-sm text-strong outline-none placeholder:truncate placeholder:text-gray-500"
        />
        {text ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Limpar busca"
            title="Limpar busca"
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-gray-400 hover:text-strong"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        ) : (
          <SearchIcon className="h-4 w-4 shrink-0 text-gray-500" />
        )}
      </div>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-subtle bg-floating py-2 shadow-2xl backdrop-blur-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {sectionTitle()}
          </p>
          <ul
            id={listId}
            role="listbox"
            aria-label={sectionTitle()}
            className="max-h-80 overflow-y-auto"
          >
            {items.map((item, i) => (
              <li
                key={itemKey(item, i)}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(item)}
                className={`mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 ${
                  i === active ? 'bg-brand/30' : 'hover:bg-fg/5'
                }`}
              >
                <MenuItemView item={item} />
              </li>
            ))}
          </ul>
          {!token.text && text.trim() && (
            <p className="border-t border-subtle px-3 pt-2 mt-1 text-[11px] text-gray-500">
              Enter para buscar
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItemView({ item }: { item: MenuItem }): React.JSX.Element {
  switch (item.kind) {
    case 'more':
      return (
        <>
          <SlidersIcon className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0">
            <span className="block text-ds-sm font-medium text-strong">Mais filtros</span>
            <span className="block truncate text-ds-xs text-gray-400">
              datas, tipo de autor e mais
            </span>
          </span>
        </>
      )
    case 'filter': {
      const Icon = FILTER_ICON[item.option.key]
      const [k, ...rest] = item.option.hint.split(':')
      return (
        <>
          <Icon className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0">
            <span className="block text-ds-sm font-medium text-strong">{item.option.title}</span>
            <span className="block truncate text-ds-xs text-gray-400">
              <strong className="font-semibold text-gray-300">{k}:</strong>
              {rest.join(':')}
            </span>
          </span>
        </>
      )
    }
    case 'user':
      return (
        <>
          <Avatar
            userId={item.user.id}
            name={item.user.displayName}
            avatarUrl={item.user.avatarUrl}
            size={20}
          />
          <span className="min-w-0 truncate text-ds-sm text-strong">
            {item.user.nickname || item.user.displayName}
          </span>
          <span className="ml-auto truncate text-ds-xs text-gray-400">@{item.user.username}</span>
        </>
      )
    case 'channel':
      return (
        <>
          <HashIcon className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0 truncate text-ds-sm text-strong">{item.channel.name}</span>
        </>
      )
    case 'value':
      return (
        <>
          <span className="text-ds-sm text-strong">{item.label}</span>
          <span className="ml-auto text-ds-xs text-gray-400">
            {item.key}:{item.value}
          </span>
        </>
      )
  }
}
