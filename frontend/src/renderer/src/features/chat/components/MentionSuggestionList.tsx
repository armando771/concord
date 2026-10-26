import { serverDisplayName } from '../../servers/lib/serverNames'
import type { MentionSuggestion } from '../lib/mentions'

/** Quem marcar com @, em cima do campo. Mouse e setas mudam o destaque. */
export default function MentionSuggestionList({
  suggestions,
  highlight,
  onPick,
  onHighlight
}: {
  suggestions: MentionSuggestion[]
  highlight: number
  onPick: (username: string) => void
  onHighlight: (index: number) => void
}): React.JSX.Element | null {
  if (suggestions.length === 0) return null
  return (
    <ul
      role="listbox"
      aria-label="Marcar alguém"
      className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-lg border border-subtle bg-floating py-1 shadow-2xl"
    >
      {suggestions.map((m, i) => (
        <li
          key={`${m.kind}:${m.username}`}
          role="option"
          aria-selected={i === highlight}
          onMouseDown={(e) => {
            // Sem tirar o foco do campo (o blur fecharia o menu).
            e.preventDefault()
            onPick(m.username)
          }}
          onMouseEnter={() => onHighlight(i)}
          className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
            i === highlight ? 'bg-brand/30 text-strong' : 'text-gray-300'
          }`}
        >
          {m.kind === 'everyone' ? (
            <>
              <span className="font-semibold">@{m.username}</span>
              <span className="text-xs text-gray-400">{m.description}</span>
            </>
          ) : (
            <>
              <span className="font-semibold">{serverDisplayName(m, m)}</span>
              <span className="text-xs text-gray-400">@{m.username}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
