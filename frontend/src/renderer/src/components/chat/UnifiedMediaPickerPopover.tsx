import { useEffect, useRef, useState } from 'react'
import { filterEmoteCategories } from '../../lib/emotes'
import { fetchTrendingGifs, searchGifs, type GiphyItem } from '../../api/giphy'
import {
  type ServerSticker,
  stickerFileUrl
} from '../../api/stickers'
import { useStickerStore } from '../../store/stickerStore'
import { useAuthStore } from '../../store/authStore'
import { ensureMediaToken } from '../../store/mediaToken'
import { PlusIcon, TrashIcon } from '../icons'
import StickerUploadModal from './StickerUploadModal'

type TabType = 'emojis' | 'gifs' | 'stickers'

interface UnifiedMediaPickerPopoverProps {
  serverId?: string | null
  onSelectEmoji: (emoji: string) => void
  onSelectGif: (gif: GiphyItem) => void
  onSelectSticker: (sticker: ServerSticker) => void
  onClose: () => void
}

function StickerItem({
  sticker,
  canDelete,
  onSelect,
  onDelete
}: {
  sticker: ServerSticker
  canDelete: boolean
  onSelect: (stk: ServerSticker) => void
  onDelete: (stk: ServerSticker) => void
}): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ensureMediaToken()
      .then((token) => {
        if (active) setSrc(stickerFileUrl(sticker.id, token))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [sticker.id])

  return (
    <div className="group relative flex h-20 w-20 items-center justify-center rounded-xl bg-white/5 p-1 transition-all hover:bg-white/10 hover:scale-105 cursor-pointer">
      <button
        type="button"
        title={sticker.name}
        onClick={() => onSelect(sticker)}
        className="flex h-full w-full items-center justify-center cursor-pointer"
      >
        {src ? (
          <img
            src={src}
            alt={sticker.name}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="h-10 w-10 animate-pulse rounded bg-white/10" />
        )}
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(sticker)
          }}
          title="Excluir figurinha"
          className="absolute right-1 top-1 hidden rounded-md bg-black/80 p-1 text-red-400 opacity-80 hover:opacity-100 group-hover:block"
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      )}
    </div>
  )
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
  const stickers = useStickerStore((s) => (serverId ? s.stickersByServer[serverId] ?? [] : []))
  const loadStickers = useStickerStore((s) => s.loadStickers)
  const deleteSticker = useStickerStore((s) => s.deleteSticker)
  const currentUserId = useAuthStore((s) => s.user?.id)

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
              {!serverId ? (
                <div className="flex h-48 flex-col items-center justify-center text-center p-4 text-xs text-gray-500">
                  <span>Figurinhas ficam disponíveis em canais de servidores.</span>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      {stickers.length} / 60 figurinhas
                    </span>
                    <button
                      type="button"
                      onClick={() => setUploadOpen(true)}
                      className="flex items-center gap-1 rounded-md bg-violet-600/30 px-2 py-1 text-[11px] font-medium text-violet-300 transition-colors hover:bg-violet-600/50 cursor-pointer"
                    >
                      <PlusIcon className="h-3 w-3" />
                      <span>Nova Figurinha</span>
                    </button>
                  </div>

                  {stickers.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center text-center p-4 text-xs text-gray-500">
                      <span className="mb-2">Nenhuma figurinha no servidor ainda.</span>
                      <button
                        type="button"
                        onClick={() => setUploadOpen(true)}
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20 cursor-pointer"
                      >
                        Adicionar a primeira
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {stickers
                        .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
                        .map((stk) => (
                          <StickerItem
                            key={stk.id}
                            sticker={stk}
                            canDelete={stk.uploader_id === currentUserId}
                            onSelect={(selected) => {
                              onSelectSticker(selected)
                              onClose()
                            }}
                            onDelete={(toDelete) => {
                              if (serverId) {
                                deleteSticker(serverId, toDelete.id)
                              }
                            }}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )}
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
