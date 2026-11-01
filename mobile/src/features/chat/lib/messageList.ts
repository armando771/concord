import type { Message } from '../api/messages'

// A lista do chat fica da mais nova para a mais antiga (FlatList invertida). Qualquer
// ordem de entrada (API, WebSocket, resposta do POST) vira essa ordem aqui.

const newestFirst = (a: Message, b: Message): number => {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1
  return a.id < b.id ? 1 : -1
}

/** Junta `incoming` à lista: deduplica por id (a versão nova vence) e reordena. */
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort(newestFirst)
}

export function removeMessage(current: Message[], id: string): Message[] {
  return current.filter((m) => m.id !== id)
}

/** Cursor `before` da próxima página: a mais antiga já carregada. */
export function oldestId(current: Message[]): string | undefined {
  return current[current.length - 1]?.id
}
