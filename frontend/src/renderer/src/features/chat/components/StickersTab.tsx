import { useEffect, useState } from 'react'
import { type ServerSticker, stickerFileUrl } from '../api/stickers'
import { useStickerStore, selectStickers } from '../store/stickerStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useServerAccess } from '../../servers/hooks/useServerAccess'
import { Perm } from '../../servers/lib/permissions'
import { showToast } from '../../../shared/store/toastStore'
import { ensureMediaToken } from '../store/mediaToken'
import { PlusIcon, TrashIcon } from '../../../shared/ui/icons'

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
          className="absolute right-1 top-1 rounded-md bg-black/80 p-1 text-red-400 opacity-80 hover:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-80"
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

/** Aba "Figurinhas" do seletor de mídia: as figurinhas do servidor. */
export default function StickersTab({
  serverId,
  search,
  onAdd,
  onSelectSticker
}: {
  serverId?: string | null
  search: string
  onAdd: () => void
  onSelectSticker: (sticker: ServerSticker) => void
}): React.JSX.Element {
  const stickers = useStickerStore(selectStickers(serverId))
  const deleteSticker = useStickerStore((s) => s.deleteSticker)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const viewingServer = useServerStore((s) => Boolean(serverId && s.currentServer?.id === serverId))
  const access = useServerAccess()
  const isModeratorOrOwner = viewingServer && access.can(Perm.MANAGE_EXPRESSIONS)
  // Só dá para conferir cargos do servidor aberto; em outro, o servidor decide.
  const canAdd = !viewingServer || access.can(Perm.ADD_STICKERS)

  if (!serverId) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-center p-4 text-xs text-gray-500">
        <span>Figurinhas ficam disponíveis em canais de servidores.</span>
      </div>
    )
  }

  const handleDelete = (toDelete: ServerSticker): void => {
    deleteSticker(serverId, toDelete.id).catch((err) => {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível excluir a figurinha.')
    })
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">{stickers.length} / 60 figurinhas</span>
        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded-md bg-violet-600/30 px-2 py-1 text-[11px] font-medium text-violet-300 transition-colors hover:bg-violet-600/50 cursor-pointer"
          >
            <PlusIcon className="h-3 w-3" />
            <span>Nova Figurinha</span>
          </button>
        )}
      </div>

      {stickers.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center text-center p-4 text-xs text-gray-500">
          <span className="mb-2">Nenhuma figurinha no servidor ainda.</span>
          {canAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20 cursor-pointer"
            >
              Adicionar a primeira
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {stickers
            .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
            .map((stk) => (
              <StickerItem
                key={stk.id}
                sticker={stk}
                canDelete={stk.uploader_id === currentUserId || isModeratorOrOwner}
                onSelect={onSelectSticker}
                onDelete={handleDelete}
              />
            ))}
        </div>
      )}
    </div>
  )
}
