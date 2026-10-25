import { useEffect, useMemo, useRef, useState } from 'react'
import { uploadCommentAttachment } from '../../api/proposals'
import type { ProposalComment } from '../../api/proposals'
import { ApiError } from '../../api/client'
import { searchUsers } from '../../api/users'
import {
  ACCEPT_ATTRIBUTE,
  canSubmit,
  draftStatus,
  sendErrorMessage,
  uploadErrorMessage
} from '../../lib/attachments'
import { applyMention, mentionQuery, mentionSuggestions } from '../../lib/mentions'
import { commentPreview, MAX_COMMENT, mentionIdsIn } from '../../lib/proposals'
import type { PublicUser } from '../../store/authStore'
import { useAuthStore } from '../../store/authStore'
import { useProposalStore } from '../../store/proposalStore'
import { showToast } from '../../store/toastStore'
import Button from '../Button'
import ComposerAttachments from '../chat/ComposerAttachments'
import { useAttachmentDraft, type DraftUploader } from '../chat/useAttachmentDraft'
import VoiceRecordButton from '../chat/VoiceRecordButton'
import { PaperclipIcon } from '../icons'

const SEARCH_DELAY_MS = 200

// Os anexos do comentário sobem para a rota própria das propostas (a "sala" do rascunho é a proposta).
const uploadForComment: DraftUploader = (_proposalId, file, meta, opts) =>
  uploadCommentAttachment(file, meta, opts)

function commentError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'rate_limited') return 'Calma! Você está comentando rápido demais.'
    if (err.code === 'email_not_verified') return 'Confirme seu e-mail para comentar.'
    if (err.status === 400 && err.message === 'invalid reply') {
      return 'O comentário que você respondia não existe mais.'
    }
    if (err.status === 400) return sendErrorMessage(err.status, err.message)
  }
  return err instanceof Error && err.message ? err.message : 'Não foi possível comentar.'
}

/**
 * Caixa de comentário com autocomplete do "@", resposta a outro comentário e
 * anexos (clipe, colar, arrastar e gravar áudio), como o campo do chat do
 * servidor. Como a proposta é global (não de um servidor), as pessoas vêm da
 * busca de usuários; as escolhidas ficam guardadas (nick → id) para o backend
 * avisar quem foi marcado.
 */
function CommentComposer({
  proposalId,
  replyingTo,
  onCancelReply
}: {
  proposalId: string
  replyingTo: ProposalComment | null
  onCancelReply: () => void
}): React.JSX.Element {
  const addComment = useProposalStore((s) => s.addComment)
  const meUsername = useAuthStore((s) => s.user?.username)
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [sending, setSending] = useState(false)
  const [sendingVoice, setSendingVoice] = useState(false)
  const [overDrop, setOverDrop] = useState(false)
  const [found, setFound] = useState<PublicUser[]>([])
  const [highlight, setHighlight] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const picked = useRef(new Map<string, string>())
  const input = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const { drafts, addFiles, remove, clear } = useAttachmentDraft(proposalId, uploadForComment)
  const attachmentState = draftStatus(drafts)

  const query = useMemo(() => mentionQuery(text, caret), [text, caret])
  const term = query?.query ?? ''

  // Escolher "Responder" leva o cursor para o campo.
  const replyId = replyingTo?.id
  useEffect(() => {
    if (replyId) input.current?.focus()
  }, [replyId])

  // Busca com atraso: um pedido por pausa na digitação, não por tecla.
  useEffect(() => {
    if (!term) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchUsers(term)
        .then((users) => {
          if (!cancelled) setFound(users)
        })
        .catch(() => {
          if (!cancelled) setFound([])
        })
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term])

  const suggestions = useMemo(() => {
    if (!query || dismissed) return []
    return mentionSuggestions(term, found, false, { exclude: meUsername }).items.flatMap((m) =>
      m.kind === 'user' ? [m] : []
    )
  }, [query, dismissed, term, found, meUsername])

  const pick = (username: string): void => {
    if (!query) return
    const user = found.find((u) => u.username === username)
    if (user) picked.current.set(user.username, user.id)
    const next = applyMention(text, query.start, caret, username)
    setText(next.text)
    setCaret(next.caret)
    setFound([])
    requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.setSelectionRange(next.caret, next.caret)
    })
  }

  const submittable = canSubmit(text, drafts)

  const send = async (): Promise<void> => {
    const body = text.trim()
    if (sending || !submittable) return
    setSending(true)
    try {
      await addComment(
        proposalId,
        body,
        mentionIdsIn(body, picked.current),
        replyingTo?.id ?? null,
        attachmentState.readyIds
      )
      setText('')
      setCaret(0)
      picked.current.clear()
      clear()
      onCancelReply()
    } catch (err) {
      showToast.error(commentError(err))
    } finally {
      setSending(false)
    }
  }

  // Gravação de voz: sobe e comenta na hora, como no chat.
  const handleRecorded = async (blob: Blob, durationMs: number): Promise<void> => {
    setSendingVoice(true)
    try {
      const attachment = await uploadCommentAttachment(blob, {
        filename: 'gravacao.webm',
        duration_ms: durationMs
      })
      await addComment(proposalId, '', [], replyingTo?.id ?? null, [attachment.id])
      onCancelReply()
    } catch (err) {
      showToast.error(
        err instanceof ApiError && err.status !== 400
          ? uploadErrorMessage(err.status)
          : commentError(err)
      )
    } finally {
      setSendingVoice(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setHighlight((h) => (h + step + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        pick(suggestions[Math.min(highlight, suggestions.length - 1)].username)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setDismissed(true)
        return
      }
    }
    if (e.key === 'Escape' && replyingTo) {
      e.preventDefault()
      e.stopPropagation()
      onCancelReply()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  // Colar texto continua normal; só arquivo (ex.: print) vira anexo.
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    if (e.clipboardData.files.length === 0) return
    e.preventDefault()
    addFiles(Array.from(e.clipboardData.files))
  }

  const hasFiles = (e: React.DragEvent): boolean => e.dataTransfer.types.includes('Files')

  return (
    <div
      className={`relative flex flex-col gap-2 rounded-lg ${overDrop ? 'ring-2 ring-violet-400/60' : ''}`}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOverDrop(true)
      }}
      onDragLeave={() => setOverDrop(false)}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOverDrop(false)
        addFiles(Array.from(e.dataTransfer.files))
      }}
    >
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Marcar alguém"
          className="absolute bottom-full left-0 right-0 z-10 mb-1 overflow-hidden rounded-lg border border-white/10 bg-[#111214] py-1 shadow-2xl"
        >
          {suggestions.map((m, i) => (
            <li
              key={m.username}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(m.username)
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
      <ComposerAttachments drafts={drafts} onRemove={remove} />
      {replyingTo && (
        <div
          data-reply-bar
          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#18191c] px-3 py-1.5 text-ds-sm text-gray-300"
        >
          <div className="min-w-0 truncate">
            Respondendo a{' '}
            <span className="font-semibold text-white">@{replyingTo.author_name}</span>
            <span className="ml-2 text-gray-400">{commentPreview(replyingTo)}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            title="Cancelar resposta (Esc)"
            aria-label="Cancelar resposta"
            className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
      <textarea
        ref={input}
        value={text}
        maxLength={MAX_COMMENT}
        rows={2}
        aria-label="Escrever comentário"
        placeholder={
          replyingTo
            ? `Responder a @${replyingTo.author_name}...`
            : 'Comente, ou use @ para marcar alguém'
        }
        className="glass-input w-full resize-none rounded-lg px-3 py-2 text-ds-sm text-white"
        onChange={(e) => {
          setText(e.target.value)
          setCaret(e.target.selectionStart)
          setHighlight(0)
          setDismissed(false)
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        hidden
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            title="Anexar arquivo"
            aria-label="Anexar arquivo"
            className="shrink-0 cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <PaperclipIcon className="h-5 w-5" />
          </button>
          <VoiceRecordButton key={proposalId} disabled={sendingVoice} onRecorded={handleRecorded} />
          <span className="ml-1 truncate text-[11px] text-gray-500">
            {text.length}/{MAX_COMMENT} · Enter envia, Shift+Enter quebra a linha
          </span>
        </div>
        <Button
          type="button"
          className="shrink-0 px-3 py-1 text-xs"
          disabled={sending || !submittable}
          onClick={() => void send()}
        >
          {attachmentState.uploading
            ? 'Enviando arquivos...'
            : sending
              ? 'Enviando...'
              : 'Comentar'}
        </Button>
      </div>
    </div>
  )
}

export default CommentComposer
