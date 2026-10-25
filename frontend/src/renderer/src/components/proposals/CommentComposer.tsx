import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { searchUsers } from '../../api/users'
import { applyMention, mentionQuery, mentionSuggestions } from '../../lib/mentions'
import { MAX_COMMENT, mentionIdsIn } from '../../lib/proposals'
import type { PublicUser } from '../../store/authStore'
import { useAuthStore } from '../../store/authStore'
import { useProposalStore } from '../../store/proposalStore'
import { showToast } from '../../store/toastStore'
import Button from '../Button'

const SEARCH_DELAY_MS = 200

function commentError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'rate_limited') return 'Calma! Você está comentando rápido demais.'
    if (err.code === 'email_not_verified') return 'Confirme seu e-mail para comentar.'
  }
  return err instanceof Error && err.message ? err.message : 'Não foi possível comentar.'
}

/**
 * Caixa de comentário com autocomplete do "@". Como a proposta é global (não
 * de um servidor), as pessoas vêm da busca de usuários; as escolhidas ficam
 * guardadas (nick → id) para o backend avisar quem foi marcado.
 */
function CommentComposer({ proposalId }: { proposalId: string }): React.JSX.Element {
  const addComment = useProposalStore((s) => s.addComment)
  const meUsername = useAuthStore((s) => s.user?.username)
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [sending, setSending] = useState(false)
  const [found, setFound] = useState<PublicUser[]>([])
  const [highlight, setHighlight] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const picked = useRef(new Map<string, string>())
  const input = useRef<HTMLTextAreaElement>(null)

  const query = useMemo(() => mentionQuery(text, caret), [text, caret])
  const term = query?.query ?? ''

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

  const send = async (): Promise<void> => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await addComment(proposalId, body, mentionIdsIn(body, picked.current))
      setText('')
      setCaret(0)
      picked.current.clear()
    } catch (err) {
      showToast.error(commentError(err))
    } finally {
      setSending(false)
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="relative flex flex-col gap-2">
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
      <textarea
        ref={input}
        value={text}
        maxLength={MAX_COMMENT}
        rows={2}
        aria-label="Escrever comentário"
        placeholder="Comente, ou use @ para marcar alguém"
        className="glass-input w-full resize-none rounded-lg px-3 py-2 text-ds-sm text-white"
        onChange={(e) => {
          setText(e.target.value)
          setCaret(e.target.selectionStart)
          setHighlight(0)
          setDismissed(false)
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-500">
          {text.length}/{MAX_COMMENT} · Enter envia, Shift+Enter quebra a linha
        </span>
        <Button
          type="button"
          className="px-3 py-1 text-xs"
          disabled={sending || text.trim().length === 0}
          onClick={() => void send()}
        >
          {sending ? 'Enviando...' : 'Comentar'}
        </Button>
      </div>
    </div>
  )
}

export default CommentComposer
