import { useChatStore } from '../store/chatStore'
import type { Message } from '../api/messages'

// Sempre o mesmo array para sala sem lista: o seletor não pode devolver um
// novo a cada leitura (o zustand entraria em loop de render).
const NO_MESSAGES: Message[] = []

/** Lista da sala no chatStore: mensagens, se há páginas antigas e se ainda carrega. */
export function useRoomMessages(room: string): {
  messages: Message[]
  hasMore: boolean
  loading: boolean
  /** Mensagens "enviando…" desta sala. */
  pendingCount: number
} {
  const messages = useChatStore((s) => s.messagesByRoom[room] ?? NO_MESSAGES)
  const hasMore = useChatStore((s) => s.hasMoreByRoom[room] ?? false)
  const loading = useChatStore((s) => s.loadingByRoom[room] ?? true)
  const pendingCount = useChatStore((s) => s.pendingByRoom[room]?.length ?? 0)
  return { messages, hasMore, loading, pendingCount }
}
