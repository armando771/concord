import { useEffect, useRef } from 'react'
import { usePinStore, selectPins } from '../../store/pinStore'
import { useServerStore } from '../../store/serverStore'
import { useServerMemberColor, useServerNicknames } from '../../store/useServerNames'
import { serverDisplayName } from '../../lib/serverNames'
import { PinIcon, XIcon } from '../icons'
import Avatar from '../Avatar'
import type { PinnedMessage } from '../../api/messages'
import MessageAttachments from './MessageAttachments'

interface PinnedMessagesPopoverProps {
  channelId: string
  canModerate: boolean
  onClose: () => void
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

function PinnedMessageItem({
  pin,
  serverId,
  nicknames,
  canModerate,
  onJump,
  onUnpin
}: {
  pin: PinnedMessage
  serverId: string | undefined
  nicknames: Record<string, string> | undefined
  canModerate: boolean
  onJump: (id: string) => void
  onUnpin: (id: string) => void
}): React.JSX.Element {
  const authorName = serverDisplayName(
    { nickname: nicknames?.[pin.author_id] },
    pin.author,
    'Usuário'
  )
  const authorColor = useServerMemberColor(serverId, pin.author_id)
  const pinnedByName = serverDisplayName(
    { nickname: pin.pinned_by_id ? nicknames?.[pin.pinned_by_id] : undefined },
    pin.pinned_by,
    'Alguém'
  )

  return (
    <div className="group relative rounded-lg border border-white/5 bg-[#18191c]/80 p-3 transition hover:border-white/15 hover:bg-[#18191c]">
      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            userId={pin.author_id}
            name={authorName}
            avatarUrl={pin.author?.avatar_url}
            size={24}
          />
          <span
            style={authorColor ? { color: authorColor } : undefined}
            className={`truncate text-ds-sm font-semibold ${authorColor ? '' : 'text-white'}`}
          >
            {authorName}
          </span>
          <span className="text-[11px] text-gray-500">{formatDateTime(pin.created_at)}</span>
        </div>

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onJump(pin.id)}
            title="Ir para a mensagem no chat"
            className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-medium text-gray-300 hover:bg-violet-600 hover:text-white"
          >
            Ir
          </button>
          {canModerate && (
            <button
              type="button"
              onClick={() => onUnpin(pin.id)}
              title="Desafixar mensagem"
              className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-medium text-gray-400 hover:bg-red-500/20 hover:text-red-400"
            >
              Desafixar
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo do Card */}
      {pin.content && (
        <p className="mt-2 whitespace-pre-wrap break-words text-ds-sm text-gray-200">
          {pin.content}
        </p>
      )}

      {/* Anexos */}
      {pin.attachments && pin.attachments.length > 0 && (
        <div className="mt-2">
          <MessageAttachments attachments={pin.attachments} />
        </div>
      )}

      {/* Rodapé: Quem fixou */}
      <div className="mt-2.5 flex items-center gap-1 text-[10px] text-gray-500">
        <PinIcon className="h-3 w-3 text-amber-400/80" />
        <span>
          Fixado por <strong className="text-gray-400">{pinnedByName}</strong> em{' '}
          {formatDateTime(pin.pinned_at)}
        </span>
      </div>
    </div>
  )
}

export default function PinnedMessagesPopover({
  channelId,
  canModerate,
  onClose
}: PinnedMessagesPopoverProps): React.JSX.Element {
  const popoverRef = useRef<HTMLDivElement>(null)
  const pins = usePinStore(selectPins(channelId))
  const loading = usePinStore((s) => s.loadingByChannel[channelId] ?? false)
  const loadPins = usePinStore((s) => s.loadPins)
  const unpin = usePinStore((s) => s.unpin)
  const serverId = useServerStore((s) => s.currentServer?.id)
  const nicknames = useServerNicknames(serverId)

  useEffect(() => {
    void loadPins(channelId)
  }, [channelId, loadPins])

  // Fecha ao clicar fora ou apertar Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleJump = (messageId: string) => {
    window.dispatchEvent(
      new CustomEvent('concord:jump-to-message', {
        detail: { messageId }
      })
    )
  }

  const handleUnpin = async (messageId: string) => {
    try {
      await unpin(channelId, messageId)
    } catch {
      // Toast já exibido pela store
    }
  }

  return (
    <div
      ref={popoverRef}
      className="absolute right-4 top-14 z-50 flex max-h-[540px] w-96 flex-col rounded-xl border border-white/10 bg-[#1e1f22]/95 shadow-2xl backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <PinIcon className="h-4 w-4 text-amber-400" />
          <h3 className="text-ds-sm font-semibold text-white">Mensagens Fixadas</h3>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-gray-300">
            {pins.length}/50
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Fechar"
          className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && pins.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-gray-400 text-ds-sm">
            Carregando mensagens fixadas...
          </div>
        ) : pins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-gray-400">
              <PinIcon className="h-6 w-6" />
            </div>
            <p className="text-ds-sm font-medium text-gray-200">Nenhuma mensagem fixada ainda</p>
            <p className="mt-1 text-ds-xs text-gray-400">
              Mensagens importantes do canal podem ser fixadas aqui para consulta rápida.
            </p>
          </div>
        ) : (
          pins.map((pin: PinnedMessage) => (
            <PinnedMessageItem
              key={pin.id}
              pin={pin}
              serverId={serverId}
              nicknames={nicknames}
              canModerate={canModerate}
              onJump={handleJump}
              onUnpin={(id) => void handleUnpin(id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
