import { useEffect, useRef, useState } from 'react'
import { filterEmoteCategories } from '../lib/emotes'
import { fetchTrendingGifs, searchGifs, type GiphyItem } from '../api/giphy'
import type { ServerSticker } from '../api/stickers'
import { useStickerStore } from '../store/stickerStore'
import StickerUploadModal from './StickerUploadModal'
import StickersTab from './StickersTab'

type TabType = 'emojis' | 'gifs' | 'stickers'

interface UnifiedMediaPickerPopoverProps {
  serverId?: string | null
  onSelectEmoji: (emoji: string) => void
  onSelectGif: (gif: GiphyItem) => void
  onSelectSticker: (sticker: ServerSticker) => void
  onClose: () => void
}

export default function UnifiedMediaPickerPopover({
  serverId,
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  onClose
}: UnifiedMediaPickerPopoverProps): React.JSX.Element {
  const [tab, setTab] = useState<TabType>('emojis')
  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  // GIFs
  const [gifs, setGifs] = useState<GiphyItem[]>([])
  const [loadingGifs, setLoadingGifs] = useState(false)

  // Stickers
  const loadStickers = useStickerStore((s) => s.loadStickers)

  const ref = useRef<HTMLDivElement>(null)

  // Escape e click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (!uploadOpen) onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !uploadOpen) onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, uploadOpen])

  // Load stickers on mount if serverId present
  useEffect(() => {
    if (serverId) {
      loadStickers(serverId)
    }
  }, [serverId, loadStickers])

  // Load GIFs on tab switch or search change (debounced)
  useEffect(() => {
    if (tab !== 'gifs') return

    let cancelled = false
    setLoadingGifs(true)

    const timer = setTimeout(() => {
      const trimmed = search.trim()
      const req = trimmed ? searchGifs(trimmed) : fetchTrendingGifs()
      req
        .then((items) => {
          if (!cancelled) {
            setGifs(items)
            setLoadingGifs(false)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setGifs([])
            setLoadingGifs(false)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tab, search])

  const emojiCategories = filterEmoteCategories(search)

  return (
    <>
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-14 right-2 z-40 flex h-96 w-80 flex-col rounded-2xl border border-white/10 bg-[#14161a] p-3 shadow-2xl backdrop-blur-xl"
      >
        {/* Abas Superiores estilo WhatsApp */}
        <div className="mb-2 flex items-center justify-around border-b border-white/10 pb-2 text-xs font-medium text-gray-400">
          <button
            type="button"
            onClick={() => {
              setTab('emojis')
              setSearch('')
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
              tab === 'emojis'
                ? 'bg-white/10 text-white font-semibold'
                : 'hover:text-white hover:bg-white/5'
            }`}
          >
            <span>😊</span>
            <span>Emojis</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('gifs')
              setSearch('')
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
              tab === 'gifs'
                ? 'bg-white/10 text-white font-semibold'
                : 'hover:text-white hover:bg-white/5'
            }`}
          >
            <span>👾</span>
            <span>GIFs</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('stickers')
              setSearch('')
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
              tab === 'stickers'
                ? 'bg-white/10 text-white font-semibold'
                : 'hover:text-white hover:bg-white/5'
            }`}
          >
            <span>💟</span>
            <span>Figurinhas</span>
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative mb-2 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === 'emojis'
                ? 'Buscar emoji...'
                : tab === 'gifs'
                  ? 'Buscar GIFs no GIPHY...'
                  : 'Filtrar figurinhas...'
            }
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-gray-500 outline-none focus:border-violet-500/50"
          />
        </div>

        {/* Conteúdo da Aba */}
        <div className="flex-1 overflow-y-auto pr-1">
          {tab === 'emojis' && (
            <div>
              {emojiCategories.map((category) => (
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
                        onClick={() => {
                          onSelectEmoji(item.emoji)
                          onClose()
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-white/10 cursor-pointer"
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'gifs' && (
            <div>
              {loadingGifs ? (
                <div className="flex h-48 items-center justify-center text-xs text-gray-500">
                  Carregando GIFs...
                </div>
              ) : gifs.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-xs text-gray-500">
                  Nenhum GIF encontrado.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {gifs.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      title={gif.title}
                      onClick={() => {
                        onSelectGif(gif)
                        onClose()
                      }}
                      className="group relative h-28 overflow-hidden rounded-xl bg-white/5 transition-transform hover:scale-102 cursor-pointer"
                    >
                      <img
                        src={gif.preview_url || gif.url}
                        alt={gif.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'stickers' && (
            <div>
              <StickersTab
                serverId={serverId}
                search={search}
                onAdd={() => setUploadOpen(true)}
                onSelectSticker={(selected) => {
                  onSelectSticker(selected)
                  onClose()
                }}
              />
            </div>
          )}
        </div>

        {/* Rodapé Giphy se na aba de GIFs */}
        {tab === 'gifs' && (
          <div className="mt-2 flex items-center justify-center border-t border-white/5 pt-1.5 text-[10px] text-gray-500 tracking-wider">
            Powered by GIPHY
          </div>
        )}
      </div>

      {serverId && uploadOpen && (
        <StickerUploadModal
          open={uploadOpen}
          serverId={serverId}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </>
  )
}
