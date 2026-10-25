import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import type { Message } from '../api/messages'
import { showToast } from '../store/toastStore'
import SystemMessage from './SystemMessage'
import Avatar from './Avatar'
import { useUserLook } from '../store/profileStore'
import { profileCardHandler } from '../store/profileCardStore'
import {
  applyMention,
  mentionQuery,
  mentionSuggestions,
  messageMentionsMe,
  splitMentions
} from '../lib/mentions'
import { filterEmoteCategories, QUICK_EMOTES } from '../lib/emotes'
import { messagePreview } from '../lib/polls'
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
import { useTypingSender } from './chat/useTypingSender'
import TypingIndicator from './chat/TypingIndicator'
import { draftAfterSendFailure } from '../lib/composerDraft'

export interface Mentionable {
  username: string
  display_name: string
}

interface ChatPaneProps {
  room: string
  placeholder?: string
  /** Quem pode ser marcado com @ (membros do servidor, ou a pessoa da DM). */
  mentionable?: Mentionable[]
  /** Sugere @all/@here (canal de servidor, só dono e moderadores). */
  canMentionEveryone?: boolean
}

const MAX_SUGGESTIONS = 6

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

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
      className="absolute right-4 top-8 z-30 w-64 rounded-xl border border-white/10 bg-[#18191c] p-3 shadow-2xl"
    >
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar emote..."
        className="mb-2 w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-white placeholder:text-gray-500 outline-none focus:border-violet-500/50"
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
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-lg transition-transform hover:scale-110 hover:bg-white/10"
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

function MessageItem({
  message,
  isHighlighted,
  onReply,
  onReact,
  onJumpToMessage,
  onDelete,
  onVote,
  onEndPoll
}: {
  message: Message
  isHighlighted: boolean
  onReply: () => void
  onReact: (emoji: string) => void
  onJumpToMessage: (messageId: string) => void
  onDelete: () => void
  onVote: (answerIds: number[]) => Promise<void>
  onEndPoll: () => Promise<void>
}): React.JSX.Element {
  const me = useAuthStore((s) => s.user)
  const isMine = message.author_id === me?.id
  const author = message.author
  const look = useUserLook(message.author_id, {
    name: author?.display_name ?? author?.username ?? (isMine ? me?.display_name : null) ?? 'Desconhecido',
    avatarUrl: author?.avatar_url
  })
  const name = look.name
  const openProfile = profileCardHandler(message.author_id, name, author?.username, 'right')
  const [hover, setHover] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const mentionsMe = messageMentionsMe(message, me)
  const reactions = message.reactions ?? []
  const hasReplyReference = Boolean(message.reply_to_id || message.reply_to)
  const replyAuthorName =
    message.reply_to?.author?.display_name ?? message.reply_to?.author?.username ?? 'Usuário'

  if (message.system_kind) return <SystemMessage message={message} />

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex flex-col gap-1 rounded-md px-4 py-1.5 transition-colors ${
        isHighlighted
          ? 'bg-[#5865f2]/20 ring-1 ring-[#5865f2]/50'
          : mentionsMe
            ? 'border-l-2 border-[#f0b232] bg-[#f0b232]/10 hover:bg-[#f0b232]/15'
            : 'hover:bg-white/[0.03]'
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hasReplyReference && (
        <div className="flex items-center gap-1.5 pl-4 text-xs text-gray-400">
          <span className="h-2.5 w-5 shrink-0 rounded-tl-md border-l-2 border-t-2 border-gray-600" />
          {message.reply_to ? (
            <button
              type="button"
              onClick={() => onJumpToMessage(message.reply_to!.id)}
              className="flex min-w-0 cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-gray-200"
            >
              <span className="shrink-0 font-semibold text-gray-300">@{replyAuthorName}</span>
              <span className="truncate text-gray-400">
                {message.reply_to.content || '📊 Enquete / Anexo'}
              </span>
            </button>
          ) : (
            <span className="italic text-gray-500">Mensagem original foi excluída</span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={openProfile}
          aria-label={`Perfil de ${name}`}
          className="h-9 shrink-0 cursor-pointer self-start rounded-full"
        >
          <Avatar userId={message.author_id} name={name} avatarUrl={look.avatarUrl} size={36} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <button
              type="button"
              onClick={openProfile}
              className="cursor-pointer text-sm font-semibold text-white hover:underline"
            >
              {name}
            </button>
            <span className="text-[10px] text-gray-500">{formatTime(message.created_at)}</span>
          </div>
          {message.content && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200">
              {splitMentions(message.content, message.mention_everyone ?? null).map((part, i) =>
                part.mention ? (
                  <span
                    key={i}
                    className="rounded bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]"
                  >
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

          {reactions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {reactions.map((reaction) => {
                const meReacted = me?.id ? reaction.user_ids.includes(me.id) : false
                return (
                  <button
                    key={reaction.emoji}
                    type="button"
                    onClick={() => onReact(reaction.emoji)}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                      meReacted
                        ? 'border-[#5865f2] bg-[#5865f2]/25 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{reaction.emoji}</span>
                    <span className="font-semibold">{reaction.count}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                title="Adicionar reação"
                className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                +
              </button>
            </div>
          )}
        </div>

        {(hover || pickerOpen) && (
          <div className="absolute -top-3 right-4 z-20 flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#18191c] px-1 py-0.5 shadow-lg">
            {QUICK_EMOTES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                title={`Reagir com ${emoji}`}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-sm transition-transform hover:scale-110 hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              title="Mais reações"
              className="flex h-6 cursor-pointer items-center justify-center rounded px-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              😀+
            </button>
            <button
              type="button"
              onClick={onReply}
              title="Responder"
              className="flex h-6 cursor-pointer items-center justify-center rounded px-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Responder
            </button>
            {isMine && (
              <button
                type="button"
                onClick={onDelete}
                title="Excluir mensagem"
                className="flex h-6 cursor-pointer items-center justify-center rounded px-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
              >
                Excluir
              </button>
            )}
          </div>
        )}
      </div>

      {pickerOpen && (
        <EmotePickerPopover
          onSelect={(emoji) => onReact(emoji)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

function ChatPane({
  room,
  placeholder = 'Digite sua mensagem',
  mentionable = [],
  canMentionEveryone = false
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
  const toggleReaction = useChatStore((s) => s.toggleReaction)
  const createPollInRoom = useChatStore((s) => s.createPollInRoom)
  const votePollInRoom = useChatStore((s) => s.votePollInRoom)
  const endPollInRoom = useChatStore((s) => s.endPollInRoom)
  const [pollOpen, setPollOpen] = useState(false)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [replyState, setReplyState] = useState<{ room: string; message: Message } | null>(null)
  const replyingTo = replyState?.room === room ? replyState.message : null
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { drafts, addFiles, remove: removeAttachment } = useAttachmentDraft(room)
  const typing = useTypingSender(room)
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
  const [highlightChoice, setHighlight] = useState<number | null>(null)
  const meUsername = useAuthStore((s) => s.user?.username)
  // Tab/Enter pegam o item padrão (sempre uma pessoa, se houver) até a
  // pessoa navegar com as setas.
  const { items: suggestions, defaultIndex } = mention
    ? mentionSuggestions(mention.query, mentionable, canMentionEveryone, {
        exclude: meUsername,
        max: MAX_SUGGESTIONS
      })
    : { items: [], defaultIndex: -1 }
  const highlight = highlightChoice ?? defaultIndex

  const pickMention = (username: string): void => {
    const el = inputRef.current
    if (!mention || !el) return
    const next = applyMention(draft, mention.start, el.selectionStart ?? draft.length, username)
    setDraft(next.text)
    typing.onDraftChange(next.text)
    setMention(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        const from = highlight < 0 ? (step > 0 ? -1 : 0) : highlight
        setHighlight((from + step + suggestions.length) % suggestions.length)
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && highlight >= 0) {
        e.preventDefault()
        pickMention(suggestions[highlight].username)
        return
      }
      if (e.key === 'Escape') {
        setMention(null)
        return
      }
      // Sem item escolhido, Enter/Tab seguem normais (nada de @all sem querer).
      if (e.key === 'Enter' || e.key === 'Tab') return
    }
    if (e.key === 'Escape' && replyingTo) {
      setReplyState(null)
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

  // Texto atual do campo, para um envio que falhou não apagar o que foi
  // digitado enquanto ele ia.
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!submittable || sending) return
    setSending(true)
    const sentRoom = room
    const sentText = draft
    const sentReply = replyingTo
    // Só sai do rascunho o que foi enviado: arquivo adicionado durante o envio fica.
    const sentDrafts = drafts.filter((d) => d.status === 'done').map((d) => d.localId)
    // O texto sai do campo na hora: dá para começar a próxima mensagem sem
    // esperar o servidor. Os anexos só saem quando o envio dá certo.
    typing.onSent()
    setDraft('')
    draftRef.current = ''
    setReplyState(null)
    try {
      await sendToRoom(room, sentText.trim(), attachmentState.readyIds, sentReply?.id ?? null)
      if (roomRef.current === sentRoom) {
        sentDrafts.forEach(removeAttachment)
      }
    } catch (err) {
      // Volta o texto (e a resposta) se a pessoa não começou outra mensagem.
      const restored =
        roomRef.current === sentRoom ? draftAfterSendFailure(sentText, draftRef.current) : null
      if (restored !== null) {
        setDraft(restored)
        if (sentReply) {
          setReplyState((current) => current ?? { room: sentRoom, message: sentReply })
        }
      }
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
      if (replyingTo?.id === messageId) {
        setReplyState(null)
      }
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

  const handleReact = async (messageId: string, emoji: string): Promise<void> => {
    try {
      await toggleReaction(room, messageId, emoji)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao reagir à mensagem.')
    }
  }

  const handleStartReply = (message: Message): void => {
    setReplyState({ room, message })
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleJumpToMessage = (messageId: string): void => {
    const el = document.getElementById(`msg-${messageId}`)
    if (!el) {
      showToast.info('A mensagem original é mais antiga e não está carregada na tela.')
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedId(messageId)
    window.setTimeout(() => {
      setHighlightedId((current) => (current === messageId ? null : current))
    }, 1600)
  }

  const replyTargetAuthor =
    replyingTo?.author?.display_name ?? replyingTo?.author?.username ?? 'Usuário'

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
          <div className="flex min-h-full flex-col justify-end py-4">
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
                isHighlighted={highlightedId === m.id}
                onReply={() => handleStartReply(m)}
                onReact={(emoji) => void handleReact(m.id, emoji)}
                onJumpToMessage={handleJumpToMessage}
                onDelete={() => handleDelete(m.id)}
                onVote={(answerIds) => votePollInRoom(room, m.id, answerIds)}
                onEndPoll={() => endPollInRoom(room, m.id)}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="relative shrink-0 px-4">
        {suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Marcar alguém"
            className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-lg border border-white/10 bg-[#111214] py-1 shadow-2xl"
          >
            {suggestions.map((m, i) => (
              <li
                key={`${m.kind}:${m.username}`}
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
                {m.kind === 'everyone' ? (
                  <>
                    <span className="font-semibold">@{m.username}</span>
                    <span className="text-xs text-gray-400">{m.description}</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold">{m.display_name}</span>
                    <span className="text-xs text-gray-400">@{m.username}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <ComposerAttachments drafts={drafts} onRemove={removeAttachment} />
        {replyingTo && (
          <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#18191c] px-3 py-1.5 text-xs text-gray-300">
            <div className="min-w-0 truncate">
              Respondendo a <span className="font-semibold text-white">@{replyTargetAuthor}</span>
              <span className="ml-2 text-gray-400">{messagePreview(replyingTo)}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyState(null)}
              title="Cancelar resposta (Esc)"
              className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
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
              typing.onDraftChange(e.target.value)
              setMention(mentionQuery(e.target.value, e.target.selectionStart ?? 0))
              setHighlight(null)
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => setMention(null)}
            placeholder={replyingTo ? `Responder a @${replyTargetAuthor}...` : placeholder}
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
        <TypingIndicator room={room} />
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
