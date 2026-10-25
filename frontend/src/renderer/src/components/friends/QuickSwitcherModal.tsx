import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal'
import Avatar from '../Avatar'
import { useFriendStore } from '../../store/friendStore'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { conversationRoute, conversationTitle } from '../../lib/conversations'

interface Item {
  key: string
  label: string
  hint: string
  route: string
  avatar?: { userId: string; url?: string | null }
}

/** "Encontre ou comece uma conversa": amigos e DMs abertas. */
function QuickSwitcherModal({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const meId = useAuthStore((s) => s.user?.id)
  const friends = useFriendStore((s) => s.friends)
  const conversations = useChatStore((s) => s.conversations)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const items = useMemo(() => {
    const all: Item[] = []
    const seen = new Set<string>()
    for (const c of conversations) {
      const route = conversationRoute(c, meId)
      seen.add(route)
      all.push({
        key: c.id,
        label: conversationTitle(c, meId),
        hint: c.type === 'group' ? `${c.members.length} membros` : (c.other_user?.username ?? ''),
        route,
        avatar: c.other_user ? { userId: c.other_user.id, url: c.other_user.avatar_url } : undefined
      })
    }
    for (const f of friends) {
      const route = `/dm/${f.id}`
      if (seen.has(route)) continue
      all.push({
        key: f.id,
        label: f.display_name || f.username,
        hint: f.username,
        route,
        avatar: { userId: f.id, url: f.avatar_url }
      })
    }
    const q = query.trim().toLowerCase()
    return q
      ? all.filter((i) => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q))
      : all
  }, [conversations, friends, meId, query])

  const go = (item: Item | undefined): void => {
    if (!item) return
    navigate(item.route)
    onClose()
  }

  return (
    <Modal open={open} title="Encontre ou comece uma conversa" onClose={onClose}>
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIndex(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIndex((i) => Math.min(i + 1, items.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIndex((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            go(items[index])
          }
        }}
        placeholder="Para onde você quer ir?"
        className="w-full rounded-md border border-black/40 bg-[#111214] px-3 py-2.5 text-base text-white outline-none placeholder:text-gray-500 focus:border-[#5865f2]"
      />
      <div className="mt-3 max-h-80 overflow-y-auto">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">Nada encontrado.</p>
        )}
        {items.map((item, i) => (
          <button
            key={item.key}
            type="button"
            onMouseEnter={() => setIndex(i)}
            onClick={() => go(item)}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left ${
              i === index ? 'bg-white/10' : ''
            }`}
          >
            {item.avatar ? (
              <Avatar
                userId={item.avatar.userId}
                name={item.label}
                avatarUrl={item.avatar.url}
                size={24}
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5865f2] text-[11px] font-bold text-white">
                {item.label.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm text-white">{item.label}</span>
            <span className="truncate text-xs text-gray-500">{item.hint}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

export default QuickSwitcherModal
