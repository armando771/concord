import { slashSuggestions, type SlashSuggestion } from '../lib/music'

/** Lista dos comandos (Maestro, /tts) ao digitar "/" no chat. */
function SlashSuggestions({
  input,
  commands,
  onPick
}: {
  input: string
  commands: SlashSuggestion[]
  onPick: (command: string) => void
}): React.JSX.Element | null {
  const items = slashSuggestions(input, commands)
  if (items.length === 0) return null
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-subtle bg-floating p-1 shadow-2xl">
      {items.map((s) => (
        <button
          key={s.command}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault() // não tira o foco do campo
            onPick(s.command + ' ')
          }}
          className="flex w-full cursor-pointer items-baseline gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-fg/10"
        >
          <span className="shrink-0 whitespace-nowrap font-semibold text-strong">{s.usage}</span>
          <span className="min-w-0 truncate text-xs text-gray-500">
            {s.description ?? s.aliases.join(' · ')}
          </span>
        </button>
      ))}
    </div>
  )
}

export default SlashSuggestions
