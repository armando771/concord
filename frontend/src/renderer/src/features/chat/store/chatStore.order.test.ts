import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '../api/messages'

// Replays das corridas que deixavam mensagem recente no topo da conversa.
// A API e o WebSocket são falsos e controlados pelo teste.

const api = vi.hoisted(() => ({
  editMessage: vi.fn(),
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
  editMessage: api.editMessage,
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
vi.mock('../../../shared/api/ws', () => ({
  WsClient: class {
    connect = vi.fn()
    disconnect = vi.fn()
    subscribe = vi.fn()
    unsubscribe = vi.fn()
    sendEvent = vi.fn()
    isConnected = (): boolean => true
  }
}))
// markConversationRead: o "lido" sai num timer que pode disparar depois do teste (máquina lenta).
vi.mock('../api/conversations', () => ({
  listConversations: vi.fn(async () => []),
  markConversationRead: vi.fn(async () => {})
}))
vi.mock('../../friends/api/presence', () => ({ fetchPresence: vi.fn(async () => ({})) }))
vi.mock('../../servers/api/channels', () => ({ listChannels: vi.fn(async () => []) }))
vi.mock('../../../app/router', () => ({ router: { navigate: vi.fn() } }))
vi.mock('../../call/lib/sounds', () => ({ playSound: vi.fn() }))
vi.mock('../../notifications/lib/notifications', () => ({
  messageNotification: () => null,
  mentionNotification: () => null,
  notificationSound: () => null,
  notifyDesktop: vi.fn(),
  deliverDesktop: vi.fn(),
  messageAlert: () => null
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: 'tok', user: { id: 'me', username: 'me', status: 'online' } })
  }
}))
vi.mock('../../servers/store/serverStore', () => ({ useServerStore: { getState: () => ({ channels: [] }) } }))
// O chatStore consulta quem está bloqueado e se a janela tem foco.
vi.mock('../../friends/store/friendStore', () => ({ useFriendStore: { getState: () => ({ blocked: [] }) } }))
vi.stubGlobal('document', { hasFocus: () => false })
vi.mock('../../call/store/callStore', () => ({ useCallStore: { getState: () => ({}) } }))
vi.mock('../../levels/store/levelStore', () => ({ useLevelStore: { getState: () => ({}) } }))
vi.mock('../../call/store/soundboardStore', () => ({ useSoundboardStore: { getState: () => ({}) } }))
vi.mock('../../profile/store/profileStore', () => ({ useProfileStore: { getState: () => ({}) } }))
vi.mock('../../../shared/store/toastStore', () => ({ showToast: {} }))
vi.mock('../../notifications/store/notificationPrefsStore', () => ({ notificationPrefs: () => ({}) }))

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

  it('loadOlder sem nada mais antigo encerra o histórico (o scroll infinito para)', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(1, 50)) // página cheia: pode haver mais
    await opening
    expect(useChatStore.getState().hasMoreByRoom[ROOM]).toBe(true)
    const older = useChatStore.getState().loadOlder(ROOM)
    await respond([]) // o histórico tinha exatamente uma página
    await older
    expect(useChatStore.getState().hasMoreByRoom[ROOM]).toBe(false)
    expect(contents()).toEqual(range(1, 50))
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

  it('message:update troca o texto sem tirar a mensagem do lugar nem contar como nova', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(1, 5))
    await opening
    const target = msg(2)
    const edited = {
      ...target,
      content: 'm2 editada',
      edited_at: new Date(T0 + 60_000).toISOString()
    }
    useChatStore.getState().handleWsEvent({
      type: 'message:update',
      payload: { message: edited, conversation_id: CONV }
    })
    expect(contents()).toEqual(['m1', 'm2 editada', 'm3', 'm4', 'm5'])
    expect(useChatStore.getState().unreadByRoom[ROOM] ?? 0).toBe(0)
    // Edição de mensagem que não está carregada não cria entrada solta.
    useChatStore.getState().handleWsEvent({
      type: 'message:update',
      payload: { message: { ...msg(99), content: 'fora' }, conversation_id: CONV }
    })
    expect(contents()).toEqual(['m1', 'm2 editada', 'm3', 'm4', 'm5'])
  })

  it('editInRoom aplica a resposta do PATCH, e o WS mais velho que chega depois não desfaz', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(1, 3))
    await opening
    const target = msg(3, { author_id: 'me' })
    const v1 = { ...target, content: 'v1', edited_at: new Date(T0 + 60_000).toISOString() }
    const v2 = { ...target, content: 'v2', edited_at: new Date(T0 + 120_000).toISOString() }
    api.editMessage.mockResolvedValueOnce(v2)
    await useChatStore.getState().editInRoom(ROOM, target.id, 'v2')
    expect(api.editMessage).toHaveBeenCalledWith(ROOM, target.id, 'v2')
    useChatStore.getState().handleWsEvent({
      type: 'message:update',
      payload: { message: v1, conversation_id: CONV }
    })
    expect(contents()).toEqual(['m1', 'm2', 'v2'])
  })
})

describe('loadOlderUntil (pular para mensagem antiga)', () => {
  it('carrega páginas antigas até a mensagem aparecer', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(101, 150))
    await opening
    const target = msg(20)
    const jumping = useChatStore.getState().loadOlderUntil(ROOM, target.id)
    await respond(page(51, 100))
    await respond(page(1, 50))
    expect(await jumping).toBe(true)
    expect(contents()).toEqual(range(1, 150))
    expect(api.pending).toHaveLength(0)
  })

  it('já carregada: não pede nada', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(1, 50))
    await opening
    expect(await useChatStore.getState().loadOlderUntil(ROOM, msg(10).id)).toBe(true)
    expect(api.pending).toHaveLength(0)
  })

  it('para no começo da conversa e no limite de páginas', async () => {
    const opening = useChatStore.getState().openRoom(ROOM)
    await respond(page(51, 100))
    await opening
    const missing = useChatStore.getState().loadOlderUntil(ROOM, 'sumiu')
    await respond(page(31, 50)) // página incompleta: acabou o histórico
    expect(await missing).toBe(false)
    expect(api.pending).toHaveLength(0)

    useChatStore.getState().reset()
    const again = useChatStore.getState().openRoom(ROOM)
    await respond(page(151, 200))
    await again
    const capped = useChatStore.getState().loadOlderUntil(ROOM, 'sumiu', 2)
    await respond(page(101, 150))
    await respond(page(51, 100))
    expect(await capped).toBe(false)
    expect(api.pending).toHaveLength(0)
  })
})
