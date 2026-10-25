import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '../api/messages'

// Replays das corridas que deixavam mensagem recente no topo da conversa.
// A API e o WebSocket são falsos e controlados pelo teste.

const api = vi.hoisted(() => ({
  pending: [] as Array<{
    room: string
    before?: string
    resolve: (page: Message[]) => void
  }>
}))

function deferredList(room: string) {
  return (id: string, before?: string): Promise<Message[]> =>
    new Promise((resolve) => api.pending.push({ room: `${room}:${id}`, before, resolve }))
}

vi.mock('../api/messages', () => ({
  MESSAGE_LIMIT: 50,
  listChannelMessages: deferredList('channel'),
  listConversationMessages: deferredList('conversation'),
  sendChannelMessage: vi.fn(),
  sendConversationMessage: vi.fn(),
  deleteChannelMessage: vi.fn(),
  deleteConversationMessage: vi.fn(),
  addChannelReaction: vi.fn(),
  removeChannelReaction: vi.fn(),
  addConversationReaction: vi.fn(),
  removeConversationReaction: vi.fn(),
  createPoll: vi.fn(),
  votePoll: vi.fn(),
  endPoll: vi.fn()
}))
vi.mock('../api/ws', () => ({
  WsClient: class {
    connect = vi.fn()
    disconnect = vi.fn()
    subscribe = vi.fn()
    unsubscribe = vi.fn()
    sendEvent = vi.fn()
    isConnected = (): boolean => true
  }
}))
vi.mock('../api/conversations', () => ({ listConversations: vi.fn(async () => []) }))
vi.mock('../api/presence', () => ({ fetchPresence: vi.fn(async () => ({})) }))
vi.mock('../api/channels', () => ({ listChannels: vi.fn(async () => []) }))
vi.mock('../router', () => ({ router: { navigate: vi.fn() } }))
vi.mock('../lib/sounds', () => ({ playSound: vi.fn() }))
vi.mock('../lib/notifications', () => ({
  messageNotification: () => null,
  mentionNotification: () => null,
  notificationSound: () => null,
  notifyDesktop: vi.fn(),
  deliverDesktop: vi.fn(),
  messageAlert: () => null
}))
vi.mock('./authStore', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: 'tok', user: { id: 'me', username: 'me', status: 'online' } })
  }
}))
vi.mock('./serverStore', () => ({ useServerStore: { getState: () => ({}) } }))
// O chatStore consulta quem está bloqueado e se a janela tem foco.
vi.mock('./friendStore', () => ({ useFriendStore: { getState: () => ({ blocked: [] }) } }))
vi.stubGlobal('document', { hasFocus: () => false })
vi.mock('./callStore', () => ({ useCallStore: { getState: () => ({}) } }))
vi.mock('./levelStore', () => ({ useLevelStore: { getState: () => ({}) } }))
vi.mock('./soundboardStore', () => ({ useSoundboardStore: { getState: () => ({}) } }))
vi.mock('./profileStore', () => ({ useProfileStore: { getState: () => ({}) } }))
vi.mock('./toastStore', () => ({ showToast: {} }))
vi.mock('./notificationPrefsStore', () => ({ notificationPrefs: () => ({}) }))

const { useChatStore } = await import('./chatStore')

const CONV = 'c1'
const ROOM = `conversation:${CONV}`
const T0 = Date.UTC(2026, 9, 25, 12, 0, 0)

/** Mensagem n da DM, n segundos depois de T0. Ids aleatórios como o UUID v4. */
const ids = new Map<number, string>()
function msg(n: number, extra: Partial<Message> = {}): Message {
  if (!ids.has(n)) ids.set(n, crypto.randomUUID())
  return {
    id: ids.get(n)!,
    author_id: 'other',
    author: { id: 'other', username: 'other', display_name: 'Other' },
    conversation_id: CONV,
    content: `m${n}`,
    created_at: new Date(T0 + n * 1000).toISOString(),
    ...extra
  }
}

/** Página da API: mais nova primeiro (ORDER BY created_at DESC). */
const page = (from: number, to: number): Message[] => {
  const out: Message[] = []
  for (let n = to; n >= from; n--) out.push(msg(n))
  return out
}

const live = (m: Message): void =>
  useChatStore.getState().handleWsEvent({ type: 'message:create', payload: { message: m } })

const contents = (): string[] =>
  (useChatStore.getState().messagesByRoom[ROOM] ?? []).map((m) => m.content)

const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `m${from + i}`)

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0))
}

async function respond(pageMessages: Message[]): Promise<void> {
  const req = api.pending.shift()
  if (!req) throw new Error('nenhuma requisição pendente')
  req.resolve(pageMessages)
  await flush()
}

beforeEach(() => {
  api.pending.length = 0
  ids.clear()
  useChatStore.getState().reset()
})

describe('ordem das mensagens no chatStore', () => {
  it('DM recebida com a conversa fechada vai para o fim ao abrir', async () => {
    // A DM chega pela sala user:<eu> mesmo sem a conversa aberta.
    live(msg(60))
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(11, 60))
    await opening
    expect(contents()).toEqual(range(11, 60))
  })

  it('mensagem ao vivo chegando durante o carregamento inicial fica no fim', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    live(msg(61)) // chegou antes da resposta da API (que não a inclui)
    await respond(page(12, 60))
    await opening
    expect(contents()).toEqual(range(12, 61))
  })

  it('mensagem ao vivo que também veio na página inicial não duplica nem sobe', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    live(msg(60))
    await respond(page(11, 60))
    await opening
    expect(contents()).toEqual(range(11, 60))
  })

  it('loadOlder não sobe mensagem recente nem duplica (página com sobreposição)', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(51, 100))
    await opening
    const older = useChatStore.getState().loadOlder(ROOM)
    // Servidor antigo (cursor por id de UUID aleatório): a página "anterior"
    // trazia mensagens novas misturadas com as antigas.
    await respond([msg(99), msg(97), msg(80), ...page(10, 50)])
    await older
    expect(contents()).toEqual(range(10, 100))
  })

  it('mensagem ao vivo durante o loadOlder continua no fim', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(51, 100))
    await opening
    const older = useChatStore.getState().loadOlder(ROOM)
    live(msg(101))
    await respond(page(1, 50))
    await older
    expect(contents()).toEqual(range(1, 101))
  })

  it('a mesma mensagem pela sala do canal e do servidor entra uma vez', async () => {
    const room = 'channel:ch1'
    const opening = useChatStore.getState().openRoom(room)
    await respond([])
    await opening
    const m = { ...msg(1), conversation_id: null, channel_id: 'ch1' }
    useChatStore.getState().handleWsEvent({ type: 'message:create', payload: { message: m } })
    useChatStore
      .getState()
      .handleWsEvent({ type: 'message:create', payload: { message: m, server_id: 's1' } })
    expect(useChatStore.getState().messagesByRoom[room]?.map((x) => x.id)).toEqual([m.id])
  })

  it('reação, enquete e mensagem de sistema (aniversário) não tiram nada do lugar', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(1, 5))
    await opening
    const target = msg(2)
    useChatStore.getState().handleWsEvent({
      type: 'message:reaction:add',
      payload: { message_id: target.id, user_id: 'x', emoji: '👍', conversation_id: CONV }
    })
    useChatStore.getState().handleWsEvent({
      type: 'message:poll:update',
      payload: {
        message_id: target.id,
        conversation_id: CONV,
        poll: {
          question: 'q',
          answers: [],
          allow_multiselect: false,
          expires_at: '2026-10-26T12:00:00Z',
          total_voters: 0
        }
      }
    })
    live(msg(6, { system_kind: 'birthday', content: 'm6' }))
    expect(contents()).toEqual(range(1, 6))
  })

  it('resposta do carregamento que chega depois de fechar a sala não ressuscita a lista', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    useChatStore.getState().closeRoom(ROOM)
    await respond(page(1, 50))
    await opening
    expect(useChatStore.getState().messagesByRoom[ROOM]).toBeUndefined()
  })
})
