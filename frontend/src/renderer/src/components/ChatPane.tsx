import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import type { Message } from '../api/messages'
import { showToast } from '../store/toastStore'
import { applyMention, mentionQuery, mentionsUser, splitMentions } from '../lib/mentions'
import PollCard from './poll/PollCard'
import CreatePollModal from './poll/CreatePollModal'
import MessageAttachments from './chat/MessageAttachments'
import { PaperclipIcon, PollIcon } from './icons'
import {
  ACCEPT_ATTRIBUTE,
  canSubmit,
  draftStatus,
  sendErrorMessage,
  uploadErrorMessage
} from '../lib/attachments'
import { uploadAttachment } from '../api/attachments'
import { ApiError } from '../api/client'
import VoiceRecordButton from './chat/VoiceRecordButton'
import ComposerAttachments from './chat/ComposerAttachments'
import { useAttachmentDraft } from './chat/useAttachmentDraft'

export interface Mentionable {
  username: string
  display_name: string
}

interface ChatPaneProps {
  room: string
  placeholder?: string
  /** Quem pode ser marcado com @ (membros do servidor, ou a pessoa da DM). */
  mentionable?: Mentionable[]
}

const MAX_SUGGESTIONS = 6

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function MessageItem({
  message,
  onDelete,
  onVote,
  onEndPoll
}: {
  message: Message
  onDelete: () => void
  onVote: (answerIds: number[]) => Promise<void>
  onEndPoll: () => Promise<void>
}): React.JSX.Element {
  const me = useAuthStore((s) => s.user)
  const isMine = message.author_id === me?.id
  const author = message.author
  const name =
    author?.display_name ?? author?.username ?? (isMine ? me?.display_name : 'Desconhecido')
  const initial = (name ?? '?').charAt(0).toUpperCase()
  const [hover, setHover] = useState(false)
  const mentionsMe = !isMine && mentionsUser(message.content, me?.username ?? '')

  return (
    <div
      className={`group flex gap-3 rounded-md px-4 py-1.5 transition-colors ${
        mentionsMe
          ? 'border-l-2 border-[#f0b232] bg-[#f0b232]/10 hover:bg-[#f0b232]/15'
          : 'hover:bg-white/[0.03]'
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white shadow-md">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white">{name}</span>
          <span className="text-[10px] text-gray-500">{formatTime(message.created_at)}</span>
        </div>
        {message.content && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200">
            {splitMentions(message.content).map((part, i) =>
              part.mention ? (
                <span key={i} className="rounded bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">
                  {part.text}
                </span>
              ) : (
                part.text
              )
            )}
          </p>
        )}
        {message.attachments?.length ? (
          <MessageAttachments attachments={message.attachments} />
        ) : null}
        {message.poll && (
          <PollCard poll={message.poll} isAuthor={isMine} onVote={onVote} onEnd={onEndPoll} />
        )}
      </div>
      {isMine && hover && (
        <button
          onClick={onDelete}
          title="Excluir mensagem"
          className="shrink-0 cursor-pointer text-xs font-semibold text-gray-500 transition-colors hover:text-red-400"
        >
          Excluir
        </button>
      )}
    </div>
  )
}

function ChatPane({
  room,
  placeholder = 'Digite sua mensagem',
  mentionable = []
}: ChatPaneProps): React.JSX.Element {
  const messagesByRoom = useChatStore((s) => s.messagesByRoom)
  const hasMoreByRoom = useChatStore((s) => s.hasMoreByRoom)
  const loadingByRoom = useChatStore((s) => s.loadingByRoom)
  const messages = messagesByRoom[room] ?? []
  const hasMore = hasMoreByRoom[room] ?? false
  const loading = loadingByRoom[room] ?? true
  const openRoom = useChatStore((s) => s.openRoom)
  const loadOlder = useChatStore((s) => s.loadOlder)
  const sendToRoom = useChatStore((s) => s.sendToRoom)
  const deleteFromRoom = useChatStore((s) => s.deleteFromRoom)
  const createPollInRoom = useChatStore((s) => s.createPollInRoom)
  const votePollInRoom = useChatStore((s) => s.votePollInRoom)
  const endPollInRoom = useChatStore((s) => s.endPollInRoom)
  const [pollOpen, setPollOpen] = useState(false)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { drafts, addFiles, remove: removeAttachment } = useAttachmentDraft(room)
  const attachmentState = draftStatus(drafts)
  const submittable = canSubmit(draft, drafts)
  // dragenter/dragleave disparam a cada filho; o contador evita piscar.
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [sendingVoice, setSendingVoice] = useState(false)
  // Sala atual, para um envio que termina depois da troca de sala não limpar
  // o campo da sala nova.
  const roomRef = useRef(room)
  useEffect(() => {
    roomRef.current = room
  }, [room])
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null)
  const [highlight, setHighlight] = useState(0)
  const meUsername = useAuthStore((s) => s.user?.username)
  const suggestions = mention
    ? mentionable
        .filter((m) => m.username !== meUsername)
        .filter((m) =>
          [m.username, m.display_name].some((v) =>
            v.toLowerCase().startsWith(mention.query.toLowerCase())
          )
        )
        .slice(0, MAX_SUGGESTIONS)
    : []

  const pickMention = (username: string): void => {
    const el = inputRef.current
    if (!mention || !el) return
    const next = applyMention(draft, mention.start, el.selectionStart ?? draft.length, username)
    setDraft(next.text)
    setMention(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlight((h) => (h + step + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pickMention(suggestions[highlight].username)
    } else if (e.key === 'Escape') {
      setMention(null)
    }
  }
  const [loadingOlder, setLoadingOlder] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const firstRender = useRef(true)

  useEffect(() => {
    stickToBottom.current = true
    void openRoom(room)
    return () => {
      useChatStore.getState().closeRoom(room)
    }
  }, [room, openRoom])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      bottomRef.current?.scrollIntoView()
      return
    }
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  const handleLoadOlder = async (): Promise<void> => {
    if (loadingOlder) return
    setLoadingOlder(true)
    await loadOlder(room)
    setLoadingOlder(false)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!submittable || sending) return
    setSending(true)
    const sentRoom = room
    // Só sai do rascunho o que foi enviado: arquivo adicionado durante o envio fica.
    const sentDrafts = drafts.filter((d) => d.status === 'done').map((d) => d.localId)
    try {
      await sendToRoom(room, draft.trim(), attachmentState.readyIds)
      if (roomRef.current === sentRoom) {
        setDraft('')
        sentDrafts.forEach(removeAttachment)
      }
    } catch (err) {
      showToast.error(
        err instanceof ApiError
          ? sendErrorMessage(err.status, err.message)
          : 'Falha ao enviar mensagem.'
      )
    } finally {
      setSending(false)
    }
  }

  // Áudio gravado vai sozinho; o texto digitado continua no campo.
  const handleRecorded = async (blob: Blob, durationMs: number): Promise<void> => {
    setSendingVoice(true)
    try {
      const attachment = await uploadAttachment(room, blob, {
        filename: 'gravacao.webm',
        duration_ms: durationMs
      })
      await sendToRoom(room, '', [attachment.id])
    } catch (err) {
      showToast.error(uploadErrorMessage(err instanceof ApiError ? err.status : 0))
    } finally {
      setSendingVoice(false)
    }
  }

  const handleDelete = async (messageId: string): Promise<void> => {
    try {
      await deleteFromRoom(room, messageId)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao excluir mensagem.')
    }
  }

  const hasFiles = (e: React.DragEvent): boolean => e.dataTransfer.types.includes('Files')

  const handleDragEnter = (e: React.DragEvent): void => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent): void => {
    if (!hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  const handleDrop = (e: React.DragEvent): void => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    // Colar texto continua normal; só arquivo (ex.: print) vira anexo.
    if (e.clipboardData.files.length === 0) return
    e.preventDefault()
    addFiles(Array.from(e.clipboardData.files))
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault()
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-violet-400/70 bg-black/60 text-sm font-semibold text-white">
          Solte os arquivos para enviar
        </div>
      )}
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Carregando mensagens...
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-full py-4">
            {hasMore && (
              <div className="flex justify-center py-2">
                <button
                  onClick={handleLoadOlder}
                  disabled={loadingOlder}
                  className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  {loadingOlder ? 'Carregando...' : 'Carregar mensagens anteriores'}
                </button>
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex items-center justify-center py-8 text-center text-sm text-gray-500">
                Nenhuma mensagem por aqui ainda. Seja o primeiro a escrever!
              </div>
            )}
            {messages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                onDelete={() => handleDelete(m.id)}
                onVote={(answerIds) => votePollInRoom(room, m.id, answerIds)}
                onEndPoll={() => endPollInRoom(room, m.id)}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="relative shrink-0 px-4 pb-4">
        {suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Marcar alguém"
            className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-lg border border-white/10 bg-[#111214] py-1 shadow-2xl"
          >
            {suggestions.map((m, i) => (
              <li
                key={m.username}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pickMention(m.username)
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                  i === highlight ? 'bg-[#5865f2]/30 text-white' : 'text-gray-300'
                }`}
              >
                <span className="font-semibold">{m.display_name}</span>
                <span className="text-xs text-gray-400">@{m.username}</span>
              </li>
            ))}
          </ul>
        )}
        <ComposerAttachments drafts={drafts} onRemove={removeAttachment} />
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-xl focus-within:border-violet-500/40"
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo"
            aria-label="Anexar arquivo"
            className="shrink-0 cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <PaperclipIcon className="h-5 w-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            hidden
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => setPollOpen(true)}
            title="Criar enquete"
            aria-label="Criar enquete"
            className="shrink-0 cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <PollIcon className="h-5 w-5" />
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setMention(mentionQuery(e.target.value, e.target.selectionStart ?? 0))
              setHighlight(0)
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => setMention(null)}
            placeholder={placeholder}
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
          />
          <VoiceRecordButton key={room} disabled={sendingVoice} onRecorded={handleRecorded} />
          <button
            type="submit"
            disabled={sending || !submittable}
            className="cursor-pointer rounded-lg bg-[#5865f2] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {attachmentState.uploading
              ? 'Enviando arquivos...'
              : sending
                ? 'Enviando...'
                : 'Enviar'}
          </button>
        </form>
      </div>
      <CreatePollModal
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        onCreate={(input) => createPollInRoom(room, input)}
      />
    </div>
  )
}

export default ChatPane
