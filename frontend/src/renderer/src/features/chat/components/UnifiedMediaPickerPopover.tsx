import { useEffect, useRef, useState } from 'react'
import type { GiphyItem } from '../api/giphy'
import { useGifSearch } from '../hooks/useGifSearch'
import type { ServerSticker } from '../api/stickers'
import { useStickerStore } from '../store/stickerStore'
import StickerUploadModal from './StickerUploadModal'
import StickersTab from './StickersTab'
import EmojisTab from './EmojisTab'
import GifsTab from './GifsTab'

type TabType = 'emojis' | 'gifs' | 'stickers'

const TABS: { id: TabType; icon: string; label: string; placeholder: string }[] = [
  { id: 'emojis', icon: '😊', label: 'Emojis', placeholder: 'Buscar emoji...' },
  { id: 'gifs', icon: '👾', label: 'GIFs', placeholder: 'Buscar GIFs no GIPHY...' },
  { id: 'stickers', icon: '💟', label: 'Figurinhas', placeholder: 'Filtrar figurinhas...' }
]

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

  const { gifs, loading: loadingGifs } = useGifSearch(tab === 'gifs', search)

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

  return (
    <>
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-14 right-2 z-40 flex h-96 w-80 flex-col rounded-2xl border border-white/10 bg-[#14161a] p-3 shadow-2xl backdrop-blur-xl"
      >
        {/* Abas Superiores estilo WhatsApp */}
        <div className="mb-2 flex items-center justify-around border-b border-white/10 pb-2 text-xs font-medium text-gray-400">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id)
                setSearch('')
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-white/10 text-white font-semibold'
                  : 'hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Input de Busca */}
        <div className="relative mb-2 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={TABS.find((t) => t.id === tab)?.placeholder}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-gray-500 outline-none focus:border-violet-500/50"
          />
        </div>

        {/* Conteúdo da Aba */}
        <div className="flex-1 overflow-y-auto pr-1">
          {tab === 'emojis' && (
            <EmojisTab
              search={search}
              onSelect={(emoji) => {
                onSelectEmoji(emoji)
                onClose()
              }}
            />
          )}

          {tab === 'gifs' && (
            <GifsTab
              gifs={gifs}
              loading={loadingGifs}
              onSelect={(gif) => {
                onSelectGif(gif)
                onClose()
              }}
            />
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
