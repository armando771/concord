import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '../api/messages'
import type { NotificationPrefs } from '../../notifications/lib/notifications'

// Aviso de DM/menção no chatStore: chega com a conversa fechada, avisa em
// outro chat mesmo com a janela em foco e fica quieto para quem está lendo.
// A API e o WebSocket são falsos; as regras de notificação são as de verdade.

const env = vi.hoisted(() => ({
  focused: true,
  status: 'online' as string,
  prefs: { desktop: true, taskbar: true, sound: true } as NotificationPrefs,
  pending: [] as Array<(page: Message[]) => void>
}))

const list = (): Promise<Message[]> => new Promise((resolve) => env.pending.push(resolve))

vi.mock('../api/messages', () => ({
  MESSAGE_LIMIT: 50,
  listChannelMessages: list,
  listConversationMessages: list,
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
vi.mock('../api/conversations', () => ({
  listConversations: vi.fn(async () => []),
  markConversationRead: vi.fn(async () => undefined)
}))
vi.mock('../../friends/api/presence', () => ({ fetchPresence: vi.fn(async () => ({})) }))
vi.mock('../../servers/api/channels', () => ({ listChannels: vi.fn(async () => []) }))
vi.mock('../../../app/router', () => ({ router: { navigate: vi.fn() } }))
vi.mock('../../call/lib/sounds', () => ({ playSound: vi.fn() }))
vi.mock('../../notifications/lib/notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../notifications/lib/notifications')>()),
  deliverDesktop: vi.fn()
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      accessToken: 'tok',
      user: { id: 'me', username: 'bia', status: env.status }
    })
  }
}))
vi.mock('../../servers/store/serverStore', () => ({ useServerStore: { getState: () => ({ channels: [] }) } }))
vi.mock('../../friends/store/friendStore', () => ({ useFriendStore: { getState: () => ({ blocked: [] }) } }))
vi.stubGlobal('document', { hasFocus: () => env.focused, visibilityState: 'visible' })
vi.mock('../../call/store/callStore', () => ({ useCallStore: { getState: () => ({}) } }))
vi.mock('../../levels/store/levelStore', () => ({ useLevelStore: { getState: () => ({}) } }))
vi.mock('../../call/store/soundboardStore', () => ({ useSoundboardStore: { getState: () => ({}) } }))
vi.mock('../../profile/store/profileStore', () => ({ useProfileStore: { getState: () => ({}) } }))
vi.mock('../../../shared/store/toastStore', () => ({ showToast: {} }))
vi.mock('../../notifications/store/notificationPrefsStore', () => ({ notificationPrefs: () => env.prefs }))

const { useChatStore } = await import('./chatStore')
const { useNotifySettingsStore } = await import('../../notifications/store/notifySettingsStore')
const { deliverDesktop } = await import('../../notifications/lib/notifications')
const { playSound } = await import('../../call/lib/sounds')

const author = { id: 'ana', username: 'ana', display_name: 'Ana' }
let seq = 0
function channelMsg(content: string, extra: Partial<Message> = {}): Message {
  seq++
  return {
    id: `m${seq}`,
    author_id: 'ana',
    author,
    channel_id: 'geral',
    conversation_id: null,
    content,
    mention_everyone: null,
    created_at: new Date(Date.UTC(2026, 9, 25, 12, 0, seq)).toISOString(),
    ...extra
  }
}
const dmMsg = (content: string, extra: Partial<Message> = {}): Message =>
  channelMsg(content, { channel_id: null, conversation_id: 'c1', ...extra })

/** Como chega pela sala do servidor (canal) ou pela sala user:<eu> (DM). */
function arrive(m: Message): void {
  useChatStore.getState().handleWsEvent({
    type: 'message:create',
    payload: { message: m, ...(m.channel_id ? { server_id: 's1' } : {}) }
  })
}

async function open(room: string): Promise<void> {
  const opening = useChatStore.getState().openRoom(room)
  env.pending.shift()?.([])
  await opening
}

const delivered = (): Array<Record<string, unknown>> =>
  vi
    .mocked(deliverDesktop)
    .mock.calls.map(([payload]) => payload as unknown as Record<string, unknown>)

beforeEach(() => {
  env.focused = true
  env.status = 'online'
  env.prefs = { desktop: true, taskbar: true, sound: true }
  env.pending.length = 0
  vi.mocked(deliverDesktop).mockClear()
  vi.mocked(playSound).mockClear()
  useChatStore.getState().reset()
})

describe('aviso de DM e menção com a conversa fechada', () => {
  it('menção num canal fechado, janela em foco em outro canal: avisa, toca e conta', async () => {
    await open('channel:outro')
    arrive(channelMsg('oi @bia'))
    expect(delivered()).toEqual([
      expect.objectContaining({ title: 'Ana mencionou você', toast: true, elsewhere: true })
    ])
    expect(playSound).toHaveBeenCalledWith('mention')
    const state = useChatStore.getState()
    expect(state.unreadByRoom['channel:geral']).toBe(1)
    expect(state.unreadByServer.s1).toBe(1)
    // Sala fechada não ganha lista solta de uma mensagem.
    expect(state.messagesByRoom['channel:geral']).toBeUndefined()
  })

  it('@all e resposta a mim, na tela de amigos (nenhuma sala aberta): avisam', () => {
    arrive(channelMsg('@all reunião', { mention_everyone: 'all' }))
    arrive(
      channelMsg('fechado', {
        reply_to_id: 'm0',
        reply_to: { id: 'm0', author_id: 'me', content: 'alguém?' }
      })
    )
    expect(delivered().map((p) => p.title)).toEqual(['Ana mencionou @all', 'Ana respondeu você'])
  })

  it('DM com a conversa fechada avisa, em foco ou não', () => {
    arrive(dmMsg('oi'))
    env.focused = false
    arrive(dmMsg('tá aí?'))
    expect(delivered()).toEqual([
      expect.objectContaining({ title: 'Ana', elsewhere: true }),
      expect.objectContaining({ title: 'Ana', elsewhere: true })
    ])
    expect(playSound).toHaveBeenCalledTimes(2)
    expect(useChatStore.getState().unreadByRoom['conversation:c1']).toBe(2)
    expect(useChatStore.getState().messagesByRoom['conversation:c1']).toBeUndefined()
  })

  it('lendo a conversa com a janela em foco: nem aviso nem som', async () => {
    await open('conversation:c1')
    arrive(dmMsg('oi'))
    await open('channel:geral')
    arrive(channelMsg('oi @bia'))
    expect(deliverDesktop).not.toHaveBeenCalled()
    expect(playSound).not.toHaveBeenCalled()
  })

  it('conversa aberta mas janela sem foco: avisa (sem elsewhere)', async () => {
    await open('channel:geral')
    env.focused = false
    arrive(channelMsg('oi @bia'))
    expect(delivered()).toEqual([expect.objectContaining({ title: 'Ana mencionou você' })])
    expect(delivered()[0].elsewhere).toBeUndefined()
  })

  it('"Não perturbe" e preferências desligadas silenciam', () => {
    env.status = 'dnd'
    arrive(channelMsg('oi @bia'))
    arrive(dmMsg('oi'))
    env.status = 'online'
    env.prefs = { desktop: false, taskbar: false, sound: false }
    arrive(channelMsg('de novo @bia'))
    expect(deliverDesktop).not.toHaveBeenCalled()
    expect(playSound).not.toHaveBeenCalled()
    // As não lidas continuam contando.
    expect(useChatStore.getState().unreadByRoom['channel:geral']).toBe(2)
  })

  it('nunca avisa a mim mesma, nem mensagem de canal sem menção', () => {
    arrive(channelMsg('@all oi', { author_id: 'me', mention_everyone: 'all' }))
    arrive(dmMsg('minha', { author_id: 'me' }))
    arrive(channelMsg('oi gente'))
    expect(deliverDesktop).not.toHaveBeenCalled()
  })

  it('a mesma menção pela sala do canal e do servidor avisa uma vez', async () => {
    await open('channel:outro')
    const m = channelMsg('oi @bia')
    arrive(m)
    arrive(m)
    expect(deliverDesktop).toHaveBeenCalledTimes(1)
  })
})

describe('silenciar servidor e canal', () => {
  const muted = {
    muted: true,
    muted_until: null,
    level: 'all' as const,
    suppress_everyone: false
  }

  beforeEach(() => {
    useNotifySettingsStore.getState().reset()
  })

  it('canal silenciado: sem aviso, sem som e sem não lida; menção direta vira selo', async () => {
    useNotifySettingsStore.setState({ channels: { geral: muted } })
    await open('channel:outro')
    arrive(channelMsg('bom dia'))
    arrive(channelMsg('oi @bia'))
    expect(deliverDesktop).not.toHaveBeenCalled()
    expect(playSound).not.toHaveBeenCalled()
    const state = useChatStore.getState()
    expect(state.unreadByRoom['channel:geral']).toBeUndefined()
    expect(state.unreadByServer.s1).toBeUndefined()
    expect(state.mentionsByRoom['channel:geral']).toBe(1)
    expect(state.mentionsByServer.s1).toBe(1)
  })

  it('servidor silenciado vale para todos os canais; o prazo vencido libera', async () => {
    useNotifySettingsStore.setState({ servers: { s1: muted } })
    arrive(channelMsg('oi @bia'))
    expect(deliverDesktop).not.toHaveBeenCalled()

    useNotifySettingsStore.setState({
      servers: { s1: { ...muted, muted_until: '2020-01-01T00:00:00Z' } }
    })
    arrive(channelMsg('de novo @bia'))
    expect(deliverDesktop).toHaveBeenCalledTimes(1)
  })

  it('só menções: mensagem comum não conta; @bia avisa', async () => {
    useNotifySettingsStore.setState({
      servers: { s1: { ...muted, muted: false, level: 'mentions' } }
    })
    arrive(channelMsg('bom dia'))
    expect(useChatStore.getState().unreadByRoom['channel:geral']).toBeUndefined()
    arrive(channelMsg('oi @bia'))
    expect(deliverDesktop).toHaveBeenCalledTimes(1)
    expect(useChatStore.getState().mentionsByRoom['channel:geral']).toBe(1)
  })

  it('ignorar @all: o @all não avisa, a menção direta avisa', () => {
    useNotifySettingsStore.setState({
      servers: { s1: { ...muted, muted: false, suppress_everyone: true } }
    })
    arrive(channelMsg('@all reunião', { mention_everyone: 'all' }))
    expect(deliverDesktop).not.toHaveBeenCalled()
    arrive(channelMsg('oi @bia'))
    expect(deliverDesktop).toHaveBeenCalledTimes(1)
  })

  it('DM nunca é afetada por mute de servidor', () => {
    useNotifySettingsStore.setState({ servers: { s1: muted }, channels: { c1: muted } })
    arrive(dmMsg('oi'))
    expect(deliverDesktop).toHaveBeenCalledTimes(1)
  })

  it('abrir a sala zera as menções', async () => {
    arrive(channelMsg('oi @bia'))
    expect(useChatStore.getState().mentionsByRoom['channel:geral']).toBe(1)
    await open('channel:geral')
    expect(useChatStore.getState().mentionsByRoom['channel:geral']).toBe(0)
  })
})
