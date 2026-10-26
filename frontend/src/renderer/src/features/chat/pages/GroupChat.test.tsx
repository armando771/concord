import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  conversations: [] as unknown[],
  loaded: true,
  searchOpen: false
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ conversationId: 'g1' }),
  useNavigate: () => () => {}
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: 'me' } })
}))
vi.mock('../store/chatStore', () => ({
  useChatStore: (select: (s: unknown) => unknown) =>
    select({
      conversations: state.conversations,
      conversationsLoaded: state.loaded,
      fetchConversations: vi.fn()
    })
}))
vi.mock('../../friends/store/friendStore', () => ({
  useFriendStore: (select: (s: unknown) => unknown) => select({ loadAll: vi.fn() })
}))
vi.mock('../store/searchStore', () => ({
  useSearchStore: (select: (s: unknown) => unknown) =>
    select({ scope: state.searchOpen ? { kind: 'conversation', id: 'g1' } : null })
}))
vi.mock('../../../shared/store/toastStore', () => ({ showToast: { error: vi.fn() } }))
vi.mock('../components/ChatPane', () => ({ default: () => <p>chat</p> }))
vi.mock('../components/GroupMemberRow', () => ({
  default: ({ member, canRemove }: { member: { display_name: string }; canRemove: boolean }) => (
    <li data-remove={canRemove}>{member.display_name}</li>
  )
}))
vi.mock('../components/MessageSearchBar', () => ({ default: () => <p>busca</p> }))
vi.mock('../components/SearchResultsPanel', () => ({ default: () => <p>resultados</p> }))
vi.mock('../../friends/components/GroupIcon', () => ({ default: () => <u data-group-icon /> }))
vi.mock('../../friends/components/CreateGroupModal', () => ({ default: () => <p>criar</p> }))
vi.mock('../../friends/components/ConfirmModal', () => ({
  default: ({ open, title }: { open: boolean; title: string }) => (open ? <p>{title}</p> : null)
}))
vi.mock('../../settings/components/ImageCropModal', () => ({ default: () => <p>recorte</p> }))
vi.mock('../../../shared/ui/skeleton/layouts', () => ({
  ChannelHeaderSkeleton: () => <p>skeleton-cabecalho</p>,
  ComposerSkeleton: () => <p>skeleton-campo</p>,
  MessageListSkeleton: () => <p>skeleton-lista</p>
}))

import { renderToStaticMarkup } from 'react-dom/server'
import GroupChat from './GroupChat'

const member = (id: string, name: string): Record<string, unknown> => ({
  id,
  username: id,
  display_name: name
})
const group = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'g1',
  type: 'group',
  name: 'Os amigos',
  owner_id: 'me',
  icon_url: null,
  members: [member('me', 'Eu'), member('a', 'Ana'), member('b', 'Bia')],
  ...over
})

describe('GroupChat', () => {
  beforeEach(() => {
    state.conversations = [group()]
    state.loaded = true
    state.searchOpen = false
  })

  it('mostra o nome do grupo, o chat e a lista de membros', () => {
    const html = renderToStaticMarkup(<GroupChat />)
    expect(html).toContain('value="Os amigos"')
    expect(html).toContain('chat')
    expect(html).toContain('Membros — 3')
    expect(html).toContain('Ana')
    expect(html).toContain('Sair do grupo')
  })

  it('só o dono pode remover participantes, e nunca a si mesmo', () => {
    const html = renderToStaticMarkup(<GroupChat />)
    expect(html).toContain('data-remove="false">Eu')
    expect(html).toContain('data-remove="true">Ana')
    state.conversations = [group({ owner_id: 'a' })]
    expect(renderToStaticMarkup(<GroupChat />)).not.toContain('data-remove="true"')
  })

  it('com a busca aberta, os resultados tomam o lugar dos membros', () => {
    state.searchOpen = true
    const html = renderToStaticMarkup(<GroupChat />)
    expect(html).toContain('resultados')
    expect(html).not.toContain('Membros — 3')
  })

  it('sem nome, o campo mostra os nomes dos outros como sugestão', () => {
    state.conversations = [group({ name: '' })]
    expect(renderToStaticMarkup(<GroupChat />)).toContain('placeholder="Ana, Bia"')
  })

  it('antes da primeira resposta da lista mostra o esqueleto', () => {
    state.conversations = []
    state.loaded = false
    const html = renderToStaticMarkup(<GroupChat />)
    expect(html).toContain('skeleton-lista')
    expect(html).not.toContain('Conversa não encontrada.')
  })

  it('conversa que não existe (ou não é grupo) diz isso', () => {
    state.conversations = [group({ type: 'dm' })]
    expect(renderToStaticMarkup(<GroupChat />)).toContain('Conversa não encontrada.')
  })
})
