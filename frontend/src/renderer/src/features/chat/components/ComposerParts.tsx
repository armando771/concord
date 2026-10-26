import type { ReactNode } from 'react'
import type { Message } from '../api/messages'
import type { ServerSticker } from '../api/stickers'
import type { GiphyItem } from '../api/giphy'
import { PaperclipIcon } from '../../../shared/ui/icons'
import SlashSuggestions from '../../music/components/SlashSuggestions'
import UnifiedMediaPickerPopover from './UnifiedMediaPickerPopover'
import VoiceRecordButton from './VoiceRecordButton'
import { messagePreview } from '../lib/polls'
import { submitLabel } from '../lib/chatPaneView'

// Peças do campo de mensagem do ChatPane: cada uma decide sozinha se aparece.

/** Sem poder enviar (permissão, DM bloqueada), o aviso fica no lugar do campo. */
export function ComposerGate({
  disabledReason,
  children
}: {
  disabledReason: string | undefined
  children: ReactNode
}): React.JSX.Element {
  return disabledReason ? (
    <div className="rounded-xl border border-subtle bg-input px-4 py-3 text-center text-sm text-gray-400">
      {disabledReason}
    </div>
  ) : (
    <>{children}</>
  )
}

/** "Respondendo a @fulano" em cima do campo, com o botão de cancelar. */
export function ReplyBar({
  replyingTo,
  authorName,
  onCancel
}: {
  replyingTo: Message | null
  authorName: string
  onCancel: () => void
}): React.JSX.Element | null {
  if (!replyingTo) return null
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-subtle bg-floating px-3 py-1.5 text-ds-sm text-gray-300">
      <div className="min-w-0 truncate">
        Respondendo a <span className="font-semibold text-strong">@{authorName}</span>
        <span className="ml-2 text-gray-400">{messagePreview(replyingTo)}</span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        title="Cancelar resposta (Esc)"
        className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
      >
        ✕
      </button>
    </div>
  )
}

/** Emojis, GIFs e figurinhas, aberto pelo botão do campo. */
export function MediaPicker({
  open,
  serverId,
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  onClose
}: {
  open: boolean
  serverId?: string
  onSelectEmoji: (emoji: string) => void
  onSelectGif: (gif: GiphyItem) => void
  onSelectSticker: (sticker: ServerSticker) => void
  onClose: () => void
}): React.JSX.Element | null {
  if (!open) return null
  return (
    <UnifiedMediaPickerPopover
      serverId={serverId}
      onSelectEmoji={onSelectEmoji}
      onSelectGif={onSelectGif}
      onSelectSticker={onSelectSticker}
      onClose={onClose}
    />
  )
}

/** Comandos do Maestro (/tocar…): só em canal de servidor e sem menu de @ aberto. */
export function ChannelSlashSuggestions({
  isChannel,
  mentionOpen,
  input,
  onPick
}: {
  isChannel: boolean
  mentionOpen: boolean
  input: string
  onPick: (command: string) => void
}): React.JSX.Element | null {
  if (!isChannel || mentionOpen) return null
  return <SlashSuggestions input={input} onPick={onPick} />
}

/** Anexar arquivo (só com ATTACH_FILES). */
export function AttachButton({
  show,
  onClick
}: {
  show: boolean
  onClick: () => void
}): React.JSX.Element | null {
  if (!show) return null
  return (
    <button
      type="button"
      onClick={onClick}
      title="Anexar arquivo"
      aria-label="Anexar arquivo"
      className="shrink-0 cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
    >
      <PaperclipIcon className="h-5 w-5" />
    </button>
  )
}

/** Gravar áudio (é um anexo: só com ATTACH_FILES). Recomeça a cada sala. */
export function VoiceButton({
  show,
  room,
  disabled,
  onRecorded
}: {
  show: boolean
  room: string
  disabled: boolean
  onRecorded: (blob: Blob, durationMs: number) => Promise<void>
}): React.JSX.Element | null {
  if (!show) return null
  return <VoiceRecordButton key={room} disabled={disabled} onRecorded={onRecorded} />
}

/** Enviar: desligado enquanto envia ou sem nada para enviar. */
export function SubmitButton({
  sending,
  submittable,
  uploading
}: {
  sending: boolean
  submittable: boolean
  uploading: boolean
}): React.JSX.Element {
  return (
    <button
      type="submit"
      disabled={sending || !submittable}
      className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-ds-sm font-medium text-white transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
    >
      {submitLabel(uploading, sending)}
    </button>
  )
}
