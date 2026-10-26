import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useUIStore } from '../../../shared/store/uiStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../store/chatStore'
import { useSearchStore } from '../store/searchStore'
import type { Message } from '../api/messages'
import { showToast } from '../../../shared/store/toastStore'
import SystemMessage from './SystemMessage'
import MusicMessage from '../../music/components/MusicMessage'
import MusicEphemeralList from '../../music/components/MusicEphemeralList'
import SlashSuggestions from '../../music/components/SlashSuggestions'
import { useMusicStore } from '../../music/store/musicStore'
import Avatar from '../../../shared/ui/Avatar'
import StyledName from '../../profile/components/StyledName'
import { useUserLook } from '../../profile/store/profileStore'
import { profileCardHandler } from '../../profile/store/profileCardStore'
import { userMenuHandler } from '../../profile/store/userMenuStore'
import {
  useServerMemberColor,
  useServerNickname,
  useServerNicknames
} from '../../servers/hooks/useServerNames'
import { serverDisplayName } from '../../servers/lib/serverNames'
import { useFriendStore } from '../../friends/store/friendStore'
import {
  applyMention,
  mentionLabels,
  mentionQuery,
  mentionSuggestions,
  messageMentionsMe,
  type MentionLabels
} from '../lib/mentions'
import {
  canEditMessage,
  editErrorMessage,
  editOutcome,
  lastEditableMessage
} from '../lib/messageEdit'
import { isGroupedWithPrevious } from '../lib/messageGrouping'
import MessageText from './MessageText'
import MessageEditor from './MessageEditor'
import EmotePickerPopover from './EmotePickerPopover'
import MessageActionsBar from './MessageActionsBar'
import ReactionChips from './ReactionChips'
import ReplyReference from './ReplyReference'
import { copyText } from '../../../shared/lib/clipboard'
import { messagePreview } from '../lib/polls'
import PollCard from './PollCard'
import CreatePollModal from './CreatePollModal'
import MessageAttachments from './MessageAttachments'
import MessageSticker from './MessageSticker'
import MessageGif from './MessageGif'
import UnifiedMediaPickerPopover from './UnifiedMediaPickerPopover'
import type { ServerSticker } from '../api/stickers'
import type { GiphyItem } from '../api/giphy'
import { PaperclipIcon, PollIcon, PinIcon, SmileyIcon } from '../../../shared/ui/icons'
import { selectPins, usePinStore } from '../store/pinStore'
import {
  ACCEPT_ATTRIBUTE,
  canSubmit,
  draftStatus,
  sendErrorMessage,
  uploadErrorMessage
} from '../lib/attachments'
import { uploadAttachment } from '../api/attachments'
import { ApiError } from '../../../shared/api/client'
import VoiceRecordButton from './VoiceRecordButton'
import ComposerAttachments from './ComposerAttachments'
import { useAttachmentDraft } from '../hooks/useAttachmentDraft'
import { useTypingSender } from '../hooks/useTypingSender'
import TypingIndicator from './TypingIndicator'
import PendingMessages from './PendingMessages'
import {
  afterSendFailure,
  canRestoreHere,
  replyAfterRestore,
  restoreFailedText
} from '../lib/composerDraft'
import {
  ATTACH_DENIED,
  DIRECT_CHAT_PERMISSIONS,
  sendDeniedReason,
  type ChatPermissions
} from '../lib/chatPermissions'
import { actionErrorMessage } from '../../servers/lib/permissionErrors'
import { MessageListSkeleton } from '../../../shared/ui/skeleton/layouts'
import { permissionError } from '../../servers/lib/permissions'
import { bottomScrollPlan, JUMP_HIGHLIGHT_MS } from '../lib/scrollAnchor'
import { useOlderMessages } from '../hooks/useOlderMessages'
import { useInfiniteScrollOlder } from '../hooks/useInfiniteScrollOlder'
import { useAutoFocusComposer } from '../hooks/useAutoFocusComposer'
import OlderMessagesLoader from './OlderMessagesLoader'

const NO_MENTIONABLE: Mentionable[] = []

export interface Mentionable {
  username: string
  display_name: string
  /** Apelido no servidor (só em canal de servidor). */
  nickname?: string | null
}

interface ChatPaneProps {
  room: string
  /**
   * Canal de servidor: os nomes saem com o apelido de cada um naquele
   * servidor. Sem isso (DM, grupo), vale o nome de exibição.
   */
  serverId?: string
  placeholder?: string
  /** Quem pode ser marcado com @ (membros do servidor, ou a pessoa da DM). */
  mentionable?: Mentionable[]
  /** Sugere @all/@here (canal de servidor, só dono e moderadores). */
  canMentionEveryone?: boolean
  /** Troca o campo de mensagem por este aviso (ex.: DM com alguém bloqueado). */
  disabledReason?: string
  /** O que a pessoa pode neste canal (cargos). Sem isso (DM), vale o padrão do chat. */
  permissions?: ChatPermissions
  /** Se falso (ex.: canais de sistema #avisos e #bot), esconde a ação de excluir mensagens. */
  canDeleteMessages?: boolean
}

const MAX_SUGGESTIONS = 6

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Tem texto selecionado que pega (ao menos em parte) este elemento? */
function selectionTouches(el: Element): boolean {
  const selection = window.getSelection()
  return Boolean(selection && !selection.isCollapsed && selection.containsNode(el, true))
}

function formatEditedAt(iso: string): string {
  const when = new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `Editada em ${when}`
}

function MessageItem({
  message,
  serverId,
  isHighlighted,
  mentionLabels,
  onReply,
  onReact,
  onJumpToMessage,
  onDelete,
  onVote,
  onEndPoll,
  onCopy,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  isEditing,
  savingEdit,
  canReact,
  canModerate,
  canDelete = true,
  canPin,
  onTogglePin,
  grouped = false
}: {
  /** Continuação de uma sequência do mesmo autor: só o texto, sem avatar e nome. */
  grouped?: boolean
  canPin?: boolean
  onTogglePin?: () => void
  message: Message
  /** Canal de servidor: autor e resposta com o apelido daquele servidor. */
  serverId?: string
  isHighlighted: boolean
  /** Nome mostrado nos chips de menção (@nick -> apelido/nome). */
  mentionLabels?: MentionLabels
  onReply: () => void
  onReact: (emoji: string) => void
  onJumpToMessage: (messageId: string) => void
  onDelete: () => void
  onVote: (answerIds: number[]) => Promise<void>
  onEndPoll: () => Promise<void>
  onCopy: () => void
  onStartEdit: () => void
  onSaveEdit: (draft: string) => void
  onCancelEdit: () => void
  /** Esta mensagem está aberta na edição. */
  isEditing: boolean
  savingEdit: boolean
  /** ADD_REACTIONS no canal. */
  canReact: boolean
  /** MANAGE_MESSAGES no canal: apaga mensagem de outros e encerra enquete. */
  canModerate: boolean
  /** Em canais de sistema (#avisos e #bot) nenhuma mensagem pode ser excluída. */
  canDelete?: boolean
}): React.JSX.Element {
  const me = useAuthStore((s) => s.user)
  const isMine = message.author_id === me?.id
  const author = message.author
  const look = useUserLook(message.author_id, {
    name:
      author?.display_name ??
      author?.username ??
      (isMine ? me?.display_name : null) ??
      'Desconhecido',
    avatarUrl: author?.avatar_url
  })
  const nickname = useServerNickname(serverId, message.author_id)
  const name = serverDisplayName({ nickname }, { display_name: look.name })
  const nameColor = useServerMemberColor(serverId, message.author_id)
  const replyNickname = useServerNickname(serverId, message.reply_to?.author_id)
  const replyAuthorColor = useServerMemberColor(serverId, message.reply_to?.author_id)
  const openProfile = profileCardHandler(message.author_id, name, author?.username, 'right')
  const [hover, setHover] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const authorBlocked = useFriendStore(
    (s) => !isMine && s.blocked.some((u) => u.id === message.author_id)
  )
  const [revealBlocked, setRevealBlocked] = useState(false)
  const onAuthorMenu = userMenuHandler(message.author_id, name, me?.id, author?.username)

  const mentionsMe = messageMentionsMe(message, me)
  const editable = canEditMessage(message, me?.id)
  const reactions = message.reactions ?? []
  const hasReplyReference = Boolean(message.reply_to_id || message.reply_to)
  const replyAuthorName = serverDisplayName({ nickname: replyNickname }, message.reply_to?.author)

  // Autor bloqueado e revelado: sem agrupar, para a linha não ficar sem nome.
  const compact = grouped && !authorBlocked

  const badges = (
    <>
      {message.edited_at && (
        <span className="text-ds-xs text-gray-500" title={formatEditedAt(message.edited_at)}>
          (editada)
        </span>
      )}
      {message.pinned_at && (
        <span
          className="flex items-center gap-0.5 text-ds-xs text-amber-400 font-medium"
          title="Mensagem fixada"
        >
          <PinIcon className="h-3 w-3" />
          <span>fixada</span>
        </span>
      )}
    </>
  )

  if (message.system_kind === 'music') return <MusicMessage message={message} />
  if (message.system_kind) return <SystemMessage message={message} />

  // Mensagem de quem você bloqueou: escondida, como no Discord.
  if (authorBlocked && !revealBlocked) {
    return (
      <div id={`msg-${message.id}`} className="px-4 py-1 text-ds-sm text-gray-500">
        1 mensagem bloqueada —{' '}
        <button
          type="button"
          onClick={() => setRevealBlocked(true)}
          className="cursor-pointer text-link hover:underline"
        >
          Mostrar
        </button>
      </div>
    )
  }

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex flex-col gap-1 rounded-md px-4 transition-colors ${
        compact ? 'py-0.5' : 'py-1.5'
      } ${
        mentionsMe
          ? 'border-l-2 border-warning bg-warning/10 hover:bg-warning/15'
          : 'hover:bg-fg/[0.03]'
      } ${isHighlighted ? 'msg-jump-highlight' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={(e) => {
        // Sobre texto selecionado desta linha ou link fica o menu do
        // navegador/app (copiar, copiar link); no resto da linha, o do autor.
        // Sobre anexo (imagem/vídeo) não abre o menu do autor.
        if (
          selectionTouches(e.currentTarget) ||
          (e.target as Element).closest('a, [data-message-media]')
        )
          return
        onAuthorMenu?.(e)
      }}
    >
      {hasReplyReference && (
        <ReplyReference
          authorName={message.reply_to ? replyAuthorName : null}
          authorColor={replyAuthorColor}
          content={message.reply_to?.content ?? ''}
          onJump={() => message.reply_to && onJumpToMessage(message.reply_to.id)}
        />
      )}

      <div className="flex gap-3">
        {compact ? (
          // Mesma largura do avatar; a hora aparece ao passar o mouse.
          <span
            aria-hidden="true"
            className="w-10 shrink-0 select-none self-start pt-[3px] text-center text-[10px] font-medium leading-[1.375rem] text-gray-500 opacity-0 group-hover:opacity-100"
          >
            {formatTime(message.created_at)}
          </span>
        ) : (
          <button
            type="button"
            onClick={openProfile}
            aria-label={`Perfil de ${name}`}
            className="h-10 shrink-0 cursor-pointer self-start rounded-full"
          >
            <Avatar userId={message.author_id} name={name} avatarUrl={look.avatarUrl} size={40} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {compact ? (
            (message.edited_at || message.pinned_at) && (
              <div className="flex items-baseline gap-2">{badges}</div>
            )
          ) : (
            <div className="flex items-baseline gap-2">
              <button
                type="button"
                onClick={openProfile}
                style={nameColor ? { color: nameColor } : undefined}
                className={`cursor-pointer text-ds-chat font-medium hover:underline ${
                  nameColor ? '' : 'text-strong'
                }`}
              >
                {nickname ? (
                  name
                ) : (
                  <StyledName name={name} userId={message.author_id} style={author?.name_style} />
                )}
              </button>
              <span className="text-ds-xs font-medium text-gray-500">
                {formatTime(message.created_at)}
              </span>
              {badges}
            </div>
          )}
          {isEditing ? (
            <MessageEditor
              initial={message.content}
              saving={savingEdit}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          ) : (
            message.content && (
              <MessageText
                content={message.content}
                everyone={message.mention_everyone ?? null}
                mentionLabels={mentionLabels}
              />
            )
          )}
          {message.sticker ? (
            <MessageSticker sticker={message.sticker} />
          ) : (
            (message.sticker_id ||
              (!message.content &&
                !message.gif_url &&
                !message.attachments?.length &&
                !message.poll &&
                !message.system_kind)) && (
              <div className="my-1 flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/5 p-2 text-center text-xs text-gray-500">
                Figurinha indisponível
              </div>
            )
          )}
          {message.gif_url && (
            <MessageGif gifUrl={message.gif_url} metadata={message.gif_metadata} />
          )}
          {message.attachments?.length ? (
            <MessageAttachments attachments={message.attachments} copyImages />
          ) : null}
          {message.poll && (
            <PollCard
              poll={message.poll}
              isAuthor={isMine || canModerate}
              onVote={onVote}
              onEnd={onEndPoll}
            />
          )}

          <ReactionChips
            reactions={reactions}
            meId={me?.id}
            canReact={canReact}
            serverId={serverId}
            onReact={onReact}
            onOpenPicker={() => setPickerOpen((v) => !v)}
          />
        </div>

        {(hover || pickerOpen) && (
          <MessageActionsBar
            canReact={canReact}
            onReact={onReact}
            onTogglePicker={() => setPickerOpen((v) => !v)}
            onReply={onReply}
            onCopy={message.content ? onCopy : undefined}
            onEdit={editable && !isEditing ? onStartEdit : undefined}
            canPin={canPin}
            isPinned={Boolean(message.pinned_at)}
            onTogglePin={onTogglePin}
            onDelete={canDelete && (isMine || canModerate) ? onDelete : undefined}
            deleteTitle={isMine ? 'Excluir mensagem' : 'Excluir mensagem (moderação)'}
          />
        )}
      </div>

      {pickerOpen && canReact && (
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
  serverId,
  placeholder = 'Digite sua mensagem',
  mentionable = NO_MENTIONABLE,
  canMentionEveryone = false,
  disabledReason: disabledReasonProp,
  permissions = DIRECT_CHAT_PERMISSIONS,
  canDeleteMessages = true
}: ChatPaneProps): React.JSX.Element {
  // Sem SEND_MESSAGES o campo de mensagem dá lugar ao aviso.
  const disabledReason = disabledReasonProp ?? sendDeniedReason(permissions)
  const messagesByRoom = useChatStore((s) => s.messagesByRoom)
  const hasMoreByRoom = useChatStore((s) => s.hasMoreByRoom)
  const loadingByRoom = useChatStore((s) => s.loadingByRoom)
  const messages = messagesByRoom[room] ?? []
  const pendingCount = useChatStore((s) => s.pendingByRoom[room]?.length ?? 0)
  const hasMore = hasMoreByRoom[room] ?? false
  const loading = loadingByRoom[room] ?? true
  const openRoom = useChatStore((s) => s.openRoom)
  const sendToRoom = useChatStore((s) => s.sendToRoom)
  const deleteFromRoom = useChatStore((s) => s.deleteFromRoom)
  const toggleReaction = useChatStore((s) => s.toggleReaction)
  const createPollInRoom = useChatStore((s) => s.createPollInRoom)
  const votePollInRoom = useChatStore((s) => s.votePollInRoom)
  const endPollInRoom = useChatStore((s) => s.endPollInRoom)
  const editInRoom = useChatStore((s) => s.editInRoom)
  const [pollOpen, setPollOpen] = useState(false)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  // Mensagem aberta na edição, por sala (o ServerView reaproveita o ChatPane).
  const [editState, setEditState] = useState<{ room: string; id: string } | null>(null)
  const editingId = editState?.room === room ? editState.id : null
  const [savingEdit, setSavingEdit] = useState(false)
  const meId = useAuthStore((s) => s.user?.id)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [replyState, setReplyState] = useState<{ room: string; message: Message } | null>(null)
  const replyingTo = replyState?.room === room ? replyState.message : null
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const highlightTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(highlightTimer.current), [])
  const inputRef = useRef<HTMLInputElement>(null)
  useAutoFocusComposer({ room, inputRef, canSend: !disabledReason })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { drafts, addFiles: addDraftFiles, remove: removeAttachment } = useAttachmentDraft(room)
  /** Sem ATTACH_FILES, arrastar, colar ou escolher arquivos só avisa. */
  const addFiles = (files: File[]): void => {
    if (files.length === 0) return
    if (!permissions.canAttach) {
      showToast.error(ATTACH_DENIED)
      return
    }
    addDraftFiles(files)
  }
  // Ctrl+Shift+U (atalho global) abre o seletor de arquivos deste chat.
  const filePickerRequest = useUIStore((s) => s.filePickerRequest)
  const seenFilePickerRequest = useRef(filePickerRequest)
  useEffect(() => {
    if (filePickerRequest === seenFilePickerRequest.current) return
    seenFilePickerRequest.current = filePickerRequest
    if (permissions.canAttach) fileInputRef.current?.click()
  }, [filePickerRequest, permissions.canAttach])
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
  // Envio que falha depois de sair do chat não mexe no campo (só oferece copiar).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  const nicknames = useServerNicknames(serverId)
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null)
  const [highlightChoice, setHighlight] = useState<number | null>(null)
  const meUsername = useAuthStore((s) => s.user?.username)
  const meUser = useAuthStore((s) => s.user)
  // Chips de menção: quem está no chat, eu e os autores da lista (que podem
  // ter saído do servidor). Em servidor vale o apelido; em DM, o nome.
  const roomMessages = messagesByRoom[room]
  const labels = useMemo(
    () =>
      mentionLabels([
        ...mentionable,
        ...(meUser
          ? [
              {
                username: meUser.username,
                display_name: meUser.display_name,
                nickname: nicknames?.[meUser.id]
              }
            ]
          : []),
        ...(roomMessages ?? []).flatMap((m) =>
          m.author ? [{ ...m.author, nickname: nicknames?.[m.author_id] }] : []
        )
      ]),
    [mentionable, meUser, roomMessages, nicknames]
  )
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
      // Com Alt/Ctrl as setas são atalhos de navegação (useGlobalShortcuts).
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey && !e.ctrlKey && !e.metaKey) {
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
    // ↑ no campo vazio edita a sua última mensagem (como no Discord).
    if (
      e.key === 'ArrowUp' &&
      draft === '' &&
      !e.shiftKey &&
      !e.altKey &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      const last = lastEditableMessage(messages, meId)
      if (last) {
        e.preventDefault()
        startEdit(last.id)
        return
      }
    }
    if (e.key === 'Escape' && replyingTo) {
      setReplyState(null)
    }
  }

  const startEdit = (messageId: string): void => {
    setEditState({ room, id: messageId })
    requestAnimationFrame(() =>
      document.getElementById(`msg-${messageId}`)?.scrollIntoView({ block: 'nearest' })
    )
  }

  const closeEdit = (): void => {
    setEditState(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleSaveEdit = async (message: Message, draft: string): Promise<void> => {
    const hasMedia = Boolean(
      message.attachments?.length || message.sticker_id || message.sticker || message.gif_url
    )
    const outcome = editOutcome(message.content, draft, hasMedia)
    if (outcome.kind === 'unchanged') {
      closeEdit()
      return
    }
    if (outcome.kind === 'empty') {
      showToast.error('A mensagem não pode ficar vazia.')
      return
    }
    const editedRoom = room
    setSavingEdit(true)
    try {
      await editInRoom(editedRoom, message.id, outcome.content)
      if (roomRef.current === editedRoom) closeEdit()
    } catch (err) {
      showToast.error(editErrorMessage(err) ?? actionErrorMessage(err, 'Falha ao editar mensagem.'))
    } finally {
      setSavingEdit(false)
    }
  }

  const bottomRef = useRef<HTMLDivElement>(null)
  const ephemeralCount = useMusicStore((s) => s.ephemeral.length)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    stickToBottom.current = true
    void openRoom(room)
    return () => {
      useChatStore.getState().closeRoom(room)
    }
  }, [room, openRoom])

  // Abrir a sala: a lista já nasce no fim, de uma vez e antes de pintar (sem
  // rolar na frente da pessoa). Depois disso, mensagem nova rola suave.
  const positionedRoom = useRef<string | null>(null)
  const lastCount = useRef(0)
  const settleUntil = useRef(0)
  // As pendentes ("enviando…") contam: a própria mensagem aparece embaixo.
  const total = messages.length + ephemeralCount + pendingCount
  useLayoutEffect(() => {
    const plan = bottomScrollPlan({
      positionedRoom: positionedRoom.current,
      room,
      loading,
      stickToBottom: stickToBottom.current,
      countChanged: total !== lastCount.current
    })
    positionedRoom.current = plan.positionedRoom
    lastCount.current = total
    const el = scrollRef.current
    if (plan.scroll === 'instant') {
      if (el) el.scrollTop = el.scrollHeight
      // Imagem e mídia que acabam de carregar empurram o fim: acompanha por
      // um instante, só se a pessoa ainda estiver no fim.
      settleUntil.current = Date.now() + 1500
    } else if (plan.scroll === 'smooth') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [room, loading, total])

  // Conteúdo que cresce logo após abrir (imagens): mantém o fim à vista.
  useEffect(() => {
    const content = contentRef.current
    const el = scrollRef.current
    if (!content || !el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (Date.now() < settleUntil.current && stickToBottom.current) {
        el.scrollTop = el.scrollHeight
      }
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [loading, room])

  const { loadingOlder, loadOlder, loadOlderUntil } = useOlderMessages({
    room,
    messages,
    scrollRef,
    onLeaveBottom: () => {
      stickToBottom.current = false
    }
  })
  const olderSentinelRef = useInfiniteScrollOlder({
    scrollRef,
    active: hasMore && !loading,
    resetKey: `${room}:${messages[0]?.id}`,
    onReachTop: () => void loadOlder()
  })

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!submittable || sending) return
    setSending(true)
    // A própria mensagem (e o "enviando…") aparece embaixo: acompanha.
    stickToBottom.current = true
    const sentRoom = room
    const sentText = draft
    const sentReply = replyingTo
    // Só sai do rascunho o que foi enviado: arquivo adicionado durante o envio fica.
    const sentDrafts = drafts.filter((d) => d.status === 'done').map((d) => d.localId)
    // O texto sai do campo na hora: dá para começar a próxima mensagem sem
    // esperar o servidor. Os anexos só saem quando o envio dá certo.
    typing.onSent()
    setDraft('')
    setReplyState(null)
    setMention(null)
    setHighlight(null)
    try {
      await sendToRoom(room, sentText.trim(), attachmentState.readyIds, sentReply?.id ?? null)
      if (roomRef.current === sentRoom) {
        sentDrafts.forEach(removeAttachment)
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? permissionError(err.code, '') || sendErrorMessage(err.status, err.message)
          : 'Falha ao enviar mensagem.'
      handleSendFailure(message, sentRoom, sentText, sentReply)
    } finally {
      setSending(false)
    }
  }

  // O texto que falhou nunca se perde: volta sozinho se o campo continua
  // vazio; senão o aviso oferece "Restaurar" (vem antes do texto novo, com a
  // resposta). Em outra sala o campo é de lá: o aviso oferece copiar.
  const handleSendFailure = (
    message: string,
    sentRoom: string,
    sentText: string,
    sentReply: Message | null
  ): void => {
    const sentReplyState = sentReply ? { room: sentRoom, message: sentReply } : null
    const here = (): boolean => canRestoreHere(mountedRef.current, roomRef.current, sentRoom)
    const copyAction = {
      label: 'Copiar',
      run: () => void navigator.clipboard?.writeText(sentText)
    }
    if (!here()) {
      showToast.error(message, 10000, sentText.trim() ? copyAction : undefined)
      return
    }
    const current = inputRef.current?.value ?? ''
    const action = afterSendFailure(sentText, sentReply !== null, current)
    if (action === 'restore') {
      setDraft(sentText)
      setReplyState((now) => replyAfterRestore(now, sentReplyState))
      showToast.error(message)
      return
    }
    if (action === 'nothing') {
      showToast.error(message)
      return
    }
    showToast.error(message, 10000, {
      label: 'Restaurar',
      run: () => {
        if (!here()) {
          if (sentText.trim()) {
            showToast.error(
              'Você saiu da conversa: copie a mensagem que falhou.',
              10000,
              copyAction
            )
          }
          return
        }
        setDraft((now) => restoreFailedText(sentText, now))
        setReplyState((now) => replyAfterRestore(now, sentReplyState))
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    })
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

  const handleSelectEmoji = (emoji: string): void => {
    setDraft((d) => d + emoji)
    inputRef.current?.focus()
  }

  const handleSendSticker = async (stk: ServerSticker): Promise<void> => {
    stickToBottom.current = true
    const sentReply = replyingTo
    setReplyState(null)
    try {
      await sendToRoom(room, '', [], sentReply?.id ?? null, { stickerId: stk.id })
    } catch {
      showToast.error('Não foi possível enviar a figurinha.')
    }
  }

  const handleSendGif = async (gif: GiphyItem): Promise<void> => {
    stickToBottom.current = true
    const sentReply = replyingTo
    setReplyState(null)
    try {
      await sendToRoom(room, draft, [], sentReply?.id ?? null, {
        gifUrl: gif.url,
        gifMetadata: { width: gif.width, height: gif.height, preview_url: gif.preview_url }
      })
      setDraft('')
    } catch {
      showToast.error('Não foi possível enviar o GIF.')
    }
  }

  const handleDelete = async (messageId: string): Promise<void> => {
    try {
      await deleteFromRoom(room, messageId)
      if (replyingTo?.id === messageId) {
        setReplyState(null)
      }
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Falha ao excluir mensagem.'))
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
      showToast.error(actionErrorMessage(err, 'Falha ao reagir à mensagem.'))
    }
  }

  const handleStartReply = (message: Message): void => {
    setReplyState({ room, message })
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const showMessage = (el: HTMLElement, messageId: string): void => {
    stickToBottom.current = false
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Zera antes: pular de novo para a mesma mensagem reinicia o pulso.
    window.clearTimeout(highlightTimer.current)
    setHighlightedId(null)
    requestAnimationFrame(() => setHighlightedId(messageId))
    highlightTimer.current = window.setTimeout(() => {
      setHighlightedId((current) => (current === messageId ? null : current))
    }, JUMP_HIGHLIGHT_MS + 100)
  }

  // Mensagem fora da tela (resposta antiga, resultado da busca): carrega as
  // páginas antigas até ela, com a mesma âncora do scroll infinito (a tela
  // não pula enquanto carrega), e então rola até ela.
  const shownMessage = (messageId: string): HTMLElement | null => {
    const node = document.getElementById(`msg-${messageId}`)
    return node && scrollRef.current?.contains(node) ? node : null
  }

  const handleJumpToMessage = async (messageId: string): Promise<void> => {
    const el = shownMessage(messageId)
    if (el) {
      showMessage(el, messageId)
      return
    }
    const startedRoom = room
    const found = await loadOlderUntil(messageId)
    if (roomRef.current === startedRoom) showAfterLoading(messageId, found)
  }

  const showAfterLoading = (messageId: string, found: boolean): void => {
    if (!found) {
      showToast.info('Não encontrei essa mensagem: ela pode ter sido apagada ou ser antiga demais.')
      return
    }
    // Espera o React desenhar a página que chegou.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const node = shownMessage(messageId)
        if (node) showMessage(node, messageId)
      })
    )
  }

  // Clique num resultado da busca: pula quando a sala já carregou.
  const pendingJump = useSearchStore((s) => s.pendingJump)
  useEffect(() => {
    if (!pendingJump || pendingJump.room !== room || loading) return
    useSearchStore.getState().clearJump()
    void handleJumpToMessage(pendingJump.messageId)
    // handleJumpToMessage muda a cada render; o gatilho é o pedido de pulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJump, room, loading])

  useEffect(() => {
    const onJump = (e: Event): void => {
      const detail = (e as CustomEvent<{ messageId: string }>).detail
      if (detail?.messageId) {
        void handleJumpToMessage(detail.messageId)
      }
    }
    window.addEventListener('concord:jump-to-message', onJump)
    return () => window.removeEventListener('concord:jump-to-message', onJump)
  }, [room])

  const isChannel = room.startsWith('channel:')
  const channelId = isChannel ? room.slice('channel:'.length) : null

  const handleTogglePin = async (message: Message): Promise<void> => {
    if (!channelId) return
    if (message.pinned_at) {
      await usePinStore.getState().unpin(channelId, message.id)
    } else {
      await usePinStore.getState().pin(channelId, message.id)
    }
  }

  // selectPins: sem fixadas devolve sempre o mesmo array (senão: React #185).
  const pins = usePinStore(selectPins(channelId ?? ''))
  const loadPins = usePinStore((s) => s.loadPins)

  useEffect(() => {
    if (channelId) {
      void loadPins(channelId)
    }
  }, [channelId, loadPins])

  const latestPin = pins[0]
  const latestPinAuthorName = serverDisplayName(
    { nickname: latestPin ? nicknames?.[latestPin.author_id] : undefined },
    latestPin?.author
  )
  const latestPinPreview =
    latestPin?.sticker
      ? `💟 Figurinha :${latestPin.sticker.name}:`
      : latestPin?.gif_url
      ? '👾 GIF'
      : latestPin?.content?.trim() ||
    (latestPin?.attachments?.length
      ? latestPin.attachments[0].kind === 'image'
        ? '📷 Imagem'
        : latestPin.attachments[0].kind === 'video'
          ? '🎥 Vídeo'
          : latestPin.attachments[0].kind === 'audio'
            ? '🎵 Áudio'
            : '📎 Anexo'
      : latestPin?.poll
        ? '📊 Enquete: ' + latestPin.poll.question
        : 'Mensagem fixada')

  const replyTargetAuthor = serverDisplayName(
    { nickname: replyingTo ? nicknames?.[replyingTo.author_id] : undefined },
    replyingTo?.author
  )

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
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-violet-400/70 bg-black/60 text-sm font-semibold text-white on-media">
          Solte os arquivos para enviar
        </div>
      )}

      {/* Barra com a última mensagem fixada no topo do canal */}
      {latestPin && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => void handleJumpToMessage(latestPin.id)}
          onKeyDown={(e) => e.key === 'Enter' && void handleJumpToMessage(latestPin.id)}
          title="Clique para ir até a mensagem fixada"
          className="group relative z-10 flex shrink-0 cursor-pointer items-center justify-between border-b border-subtle bg-floating px-4 py-2 backdrop-blur transition hover:bg-surface"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-400/15 text-amber-400">
              <PinIcon className="h-3.5 w-3.5" />
            </span>
            <div className="flex min-w-0 items-center gap-1.5 text-ds-xs">
              <span className="shrink-0 font-semibold text-strong">{latestPinAuthorName}:</span>
              <span className="truncate text-gray-300">{latestPinPreview}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-3">
            {pins.length > 1 && (
              <span className="rounded bg-fg/5 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                +{pins.length - 1} fixada{pins.length - 1 > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-[11px] font-medium text-violet-400 opacity-80 group-hover:opacity-100 group-hover:underline">
              Ir para mensagem →
            </span>
          </div>
        </div>
      )}

      {/* Sem o scroll anchoring do navegador: a âncora do loadOlder é a única. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto [overflow-anchor:none]"
        onScroll={handleScroll}
      >
        {loading ? (
          // closeRoom apaga a lista ao sair do canal: carregando é sempre a primeira carga.
          <MessageListSkeleton />
        ) : (
          <div ref={contentRef} className="flex min-h-full flex-col justify-end py-4">
            {hasMore && <OlderMessagesLoader ref={olderSentinelRef} loading={loadingOlder} />}
            {messages.length === 0 && (
              <div className="flex items-center justify-center py-8 text-center text-sm text-gray-500">
                Nenhuma mensagem por aqui ainda. Seja o primeiro a escrever!
              </div>
            )}
            {messages.map((m, i) => (
              <MessageItem
                key={m.id}
                message={m}
                grouped={isGroupedWithPrevious(m, messages[i - 1])}
                serverId={serverId}
                isHighlighted={highlightedId === m.id}
                mentionLabels={labels}
                onReply={() => handleStartReply(m)}
                onReact={(emoji) => void handleReact(m.id, emoji)}
                onJumpToMessage={handleJumpToMessage}
                onDelete={() => handleDelete(m.id)}
                onVote={(answerIds) => votePollInRoom(room, m.id, answerIds)}
                onEndPoll={() => endPollInRoom(room, m.id)}
                onCopy={() => copyText(m.content)}
                onStartEdit={() => startEdit(m.id)}
                onSaveEdit={(text) => void handleSaveEdit(m, text)}
                onCancelEdit={closeEdit}
                isEditing={editingId === m.id}
                savingEdit={savingEdit && editingId === m.id}
                canReact={permissions.canReact}
                canModerate={permissions.canModerate}
                canDelete={canDeleteMessages}
                canPin={isChannel && permissions.canModerate}
                onTogglePin={() => void handleTogglePin(m)}
              />
            ))}
            <PendingMessages room={room} />
            <MusicEphemeralList room={room} serverId={serverId ?? null} />
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="relative shrink-0 px-4">
        {suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Marcar alguém"
            className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-lg border border-subtle bg-floating py-1 shadow-2xl"
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
                  i === highlight ? 'bg-brand/30 text-strong' : 'text-gray-300'
                }`}
              >
                {m.kind === 'everyone' ? (
                  <>
                    <span className="font-semibold">@{m.username}</span>
                    <span className="text-xs text-gray-400">{m.description}</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold">{serverDisplayName(m, m)}</span>
                    <span className="text-xs text-gray-400">@{m.username}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <ComposerAttachments drafts={drafts} onRemove={removeAttachment} />
        {replyingTo && (
          <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-subtle bg-floating px-3 py-1.5 text-ds-sm text-gray-300">
            <div className="min-w-0 truncate">
              Respondendo a <span className="font-semibold text-strong">@{replyTargetAuthor}</span>
              <span className="ml-2 text-gray-400">{messagePreview(replyingTo)}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyState(null)}
              title="Cancelar resposta (Esc)"
              className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
            >
              ✕
            </button>
          </div>
        )}
        {disabledReason ? (
          <div className="rounded-xl border border-subtle bg-input px-4 py-3 text-center text-sm text-gray-400">
            {disabledReason}
          </div>
        ) : (
          <div className="relative">
            {mediaPickerOpen && (
              <UnifiedMediaPickerPopover
                serverId={serverId}
                onSelectEmoji={handleSelectEmoji}
                onSelectGif={handleSendGif}
                onSelectSticker={handleSendSticker}
                onClose={() => setMediaPickerOpen(false)}
              />
            )}
            <form
            onSubmit={handleSubmit}
            className="relative flex items-center gap-2 rounded-xl border border-subtle bg-input px-3 py-2 backdrop-blur-xl focus-within:border-violet-500/40"
          >
            {room.startsWith('channel:') && !mention && (
              <SlashSuggestions
                input={draft}
                onPick={(text) => {
                  setDraft(text)
                  inputRef.current?.focus()
                }}
              />
            )}
            {permissions.canAttach && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Anexar arquivo"
                aria-label="Anexar arquivo"
                className="shrink-0 cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
              >
                <PaperclipIcon className="h-5 w-5" />
              </button>
            )}
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
              className="shrink-0 cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
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
              className="min-w-0 flex-1 bg-transparent text-ds-chat text-strong placeholder:text-gray-500 outline-none"
            />
            <button
              type="button"
              onClick={() => setMediaPickerOpen((v) => !v)}
              title="Emojis, GIFs e Figurinhas"
              aria-label="Emojis, GIFs e Figurinhas"
              className="shrink-0 cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <SmileyIcon className="h-5 w-5" />
            </button>
            {permissions.canAttach && (
              <VoiceRecordButton key={room} disabled={sendingVoice} onRecorded={handleRecorded} />
            )}
            <button
              type="submit"
              disabled={sending || !submittable}
              className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-ds-sm font-medium text-white transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {attachmentState.uploading
                ? 'Enviando arquivos...'
                : sending
                  ? 'Enviando...'
                  : 'Enviar'}
            </button>
          </form>
          </div>
        )}
        <TypingIndicator room={room} serverId={serverId} />
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
