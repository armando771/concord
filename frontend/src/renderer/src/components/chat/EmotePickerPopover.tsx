import { useEffect, useRef, useState } from 'react'
import { filterEmoteCategories } from '../../lib/emotes'

/** Seletor de emoji das reações (busca + categorias). Posiciona-se no canto da linha. */
function EmotePickerPopover({
  onSelect,
  onClose
}: {
  onSelect: (emoji: string) => void
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const categories = filterEmoteCategories(search)

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-4 top-8 z-30 w-64 rounded-xl border border-subtle bg-floating p-3 shadow-2xl"
    >
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar emote..."
        className="mb-2 w-full rounded-md border border-subtle bg-input px-2.5 py-1 text-xs text-strong placeholder:text-gray-500 outline-none focus:border-violet-500/50"
      />
      <div className="max-h-56 overflow-y-auto pr-1">
        {categories.map((category) => (
          <div key={category.id} className="mb-2 last:mb-0">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {category.name}
            </div>
            <div className="grid grid-cols-6 gap-1">
              {category.items.map((item) => (
                <button
                  key={item.emoji}
                  type="button"
                  title={item.label}
                  onClick={() => {
                    onSelect(item.emoji)
                    onClose()
                  }}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-lg transition-transform hover:scale-110 hover:bg-fg/10"
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-500">Nenhum emote encontrado</div>
        )}
      </div>
    </div>
  )
}

export default EmotePickerPopover
