import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  class MockAudioWorkletNode {}
  ;(globalThis as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode = MockAudioWorkletNode
  ;(globalThis as unknown as { window: unknown }).window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
})

const mockRouter = vi.hoisted(() => ({
  navigate: vi.fn(),
  state: { location: { pathname: '/' } }
}))

vi.mock('../../../app/router', () => ({
  default: mockRouter,
  router: mockRouter
}))

const mockState = vi.hoisted(() => ({
  target: { userId: 'u1', name: 'Alvo', x: 100, y: 100, stream: false } as {
    userId: string
    name: string
    x: number
    y: number
    stream?: boolean
    conversationId?: string
  },
  audio: { volume: 0.8, muted: false },
  user: { id: 'me-id' },
  call: {
    status: 'idle',
    participants: [] as Array<{ id: string; username?: string }>,
    serverCalls: {}
  },
  server: { id: 's1', owner_id: 'dono' },
  member: { user_id: 'u1', username: 'alvo', role_ids: [] as string[] },
  canChangeNick: false
}))

vi.mock('../../call/store/userAudioStore', () => ({
  useUserAudioStore: (selector: (s: unknown) => unknown) =>
    selector({
      get: () => mockState.audio,
      setVolume: vi.fn(),
      toggleMuted: vi.fn()
    }),
  streamAudioKey: (id: string) => `stream:${id}`
}))

vi.mock('../store/userMenuStore', () => ({
  useUserMenuStore: (selector: (s: unknown) => unknown) =>
    selector({
      target: mockState.target,
      close: vi.fn()
    })
}))

vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: mockState.user })
}))

vi.mock('../../call/store/callStore', () => ({
  useCallStore: (selector: (s: unknown) => unknown) => selector(mockState.call)
}))

vi.mock('../../friends/store/friendStore', () => ({
  useRelationship: () => 'none',
  useFriendStore: (selector: (s: unknown) => unknown) =>
    selector({
      sendRequest: vi.fn(),
      accept: vi.fn(),
      unblock: vi.fn()
    })
}))

vi.mock('../../servers/store/serverStore', () => ({
  useServerStore: (selector: (s: unknown) => unknown) =>
    selector({
      currentServer: mockState.server,
      currentMembers: [mockState.member],
      roles: [],
      channels: [],
      addMemberRole: vi.fn(),
      removeMemberRole: vi.fn()
    })
}))

vi.mock('../../servers/hooks/useServerAccess', () => ({
  useServerAccess: () => ({
    isOwner: false,
    perms: 0,
    highest: 0,
    myRoles: [],
    can: () => false,
    channelPerms: () => 0,
    canInChannel: () => false,
    highestOf: () => 0,
    canActOnMember: () => false,
    canChangeNickname: () => mockState.canChangeNick ?? false,
    canDisconnectMember: () => false,
    canMoveMember: () => false,
    canManage: () => false,
    isPrivate: () => false
  })
}))

import { renderToStaticMarkup } from 'react-dom/server'
import UserContextMenu from './UserContextMenu'

describe('UserContextMenu', () => {
  it('renderiza opções padrão de usuário (Perfil, Mensagem) sem Copiar ID', () => {
    const html = renderToStaticMarkup(<UserContextMenu />)
    expect(html).toContain('Perfil')
    expect(html).toContain('Mensagem')
    expect(html).not.toContain('Copiar ID')
  })

  it('renderiza menu de si mesmo quando o alvo é o próprio usuário', () => {
    mockState.target = { userId: 'me-id', name: 'Eu Mesmo', x: 10, y: 10 }
    const html = renderToStaticMarkup(<UserContextMenu />)
    expect(html).toContain('Perfil')
    expect(html).not.toContain('Copiar ID')
    expect(html).not.toContain('Mensagem')
  })

  it('renderiza menu de stream quando alvo é uma transmissão', () => {
    mockState.target = { userId: 'streamer', name: 'Streamer', x: 10, y: 10, stream: true }
    const html = renderToStaticMarkup(<UserContextMenu />)
    expect(html).toContain('Transmissão de Streamer')
  })

  it('renderiza menu do Maestro quando o alvo é o Maestro', () => {
    mockState.target = { userId: 'maestro-bot', name: 'Maestro', x: 10, y: 10 }
    const html = renderToStaticMarkup(<UserContextMenu />)
    expect(html).toContain('Maestro')
  })

  it('renderiza opção de alterar apelido quando permitido no servidor', () => {
    mockState.target = { userId: 'u1', name: 'Alvo', x: 10, y: 10 }
    mockState.canChangeNick = true
    mockRouter.state.location.pathname = '/servers/s1/ch1'
    const html = renderToStaticMarkup(<UserContextMenu />)
    expect(html).toContain('Alterar apelido')
  })

  it('renderiza Fechar DM quando há conversationId no alvo', () => {
    mockState.target = { userId: 'u1', name: 'Alvo', x: 10, y: 10, conversationId: 'c123' }
    mockState.canChangeNick = false
    const html = renderToStaticMarkup(<UserContextMenu />)
    expect(html).toContain('Fechar DM')
  })

  it('renderiza controles de volume quando em chamada com o usuário', () => {
    mockState.target = { userId: 'u1', name: 'Alvo', x: 10, y: 10 }
    mockState.call = {
      status: 'active',
      participants: [{ id: 'u1', username: 'alvo' }],
      serverCalls: {}
    }
    const html = renderToStaticMarkup(<UserContextMenu />)
    expect(html).toContain('Volume do usuário')
  })

  it('renderiza alterar apelido no menu de si mesmo quando na tela do servidor', () => {
    mockState.target = { userId: 'me-id', name: 'Eu Mesmo', x: 10, y: 10 }
    mockState.member = { user_id: 'me-id', username: 'eu', role_ids: [] }
    mockState.canChangeNick = true
    mockRouter.state.location.pathname = '/servers/s1/ch1'
    const html = renderToStaticMarkup(<UserContextMenu />)
    expect(html).toContain('Alterar apelido')
    expect(html).toContain('Perfil')
  })
})
