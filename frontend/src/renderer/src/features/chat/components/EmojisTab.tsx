import { filterEmoteCategories } from '../lib/emotes'

/** Aba "Emojis" do seletor de mídia. */
export default function EmojisTab({
  search,
  onSelect
}: {
  search: string
  onSelect: (emoji: string) => void
}): React.JSX.Element {
  return (
    <div>
      {filterEmoteCategories(search).map((category) => (
        <div key={category.id} className="mb-3 last:mb-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {category.name}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {category.items.map((item) => (
              <button
                key={item.emoji}
                type="button"
                title={item.label}
                onClick={() => onSelect(item.emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-white/10 cursor-pointer"
              >
                {item.emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
