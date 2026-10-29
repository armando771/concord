import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// O chatStore de verdade puxa o resto do app (e o áudio).
vi.mock('../../chat/store/chatStore', () => ({
  useChatStore: (sel: (s: unknown) => unknown) => sel({ fetchPresenceFor: () => {} })
}))
// As peças da tela têm testes próprios: aqui importa o que aparece e onde.
vi.mock('../components/ServerMemberList', () => ({
  default: () => <aside data-membros="" />,
  ServerMemberGroups: () => null,
  MembersAside: ({ children }: { children: React.ReactNode }) => (
    <aside data-membros-esqueleto="">{children}</aside>
  )
}))
vi.mock('../components/ServerInviteModal', () => ({ default: () => <div data-convite="" /> }))
vi.mock('../components/ServerChannelContent', () => ({
  default: (p: { channelId?: string; channel?: { type?: string } }) => (
    <main data-conteudo={p.channelId ?? 'boas-vindas'} data-tipo={p.channel?.type ?? ''} />
  )
}))
vi.mock('../components/ChannelHeaderParts', () => ({
  ChannelTitle: ({ channel, fallback }: { channel?: { name: string }; fallback: string }) => (
    <h1>{channel?.name ?? fallback}</h1>
  ),
  ChannelActions: (p: { isVoice: boolean; canInvite: boolean }) => (
    <div data-acoes={p.isVoice ? 'voz' : 'texto'} data-convida={String(p.canInvite)} />
  ),
  ServerSearch: () => <input data-busca="" />
}))
vi.mock('../../chat/components/SearchResultsPanel', () => ({
  default: () => <aside data-resultados="" />
}))
vi.mock('../../chat/components/VoiceChatPanel', () => ({
  VOICE_CHAT_WIDE_QUERY: '(min-width: 768px)',
  default: ({ channelId }: { channelId: string }) => <aside data-chat-call={channelId} />
}))

// SSR lê o estado atual do zustand (mesmo truque do ImageContextMenu.test).
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) =>
  getSnapshot()
)

import { useAuthStore } from '../../auth/store/authStore'
import { useServerStore } from '../store/serverStore'
import { useSearchStore } from '../../chat/store/searchStore'
import { useVoiceChatPanelStore } from '../../chat/store/voiceChatPanelStore'
import { DEFAULT_EVERYONE } from '../lib/permissions'
import { ServerView } from './ServerView'

function render(path = '/servers/s1/channels/t1'): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/servers/:id/channels/:channelId" element={<ServerView />} />
        <Route path="/servers/:id" element={<ServerView />} />
      </Routes>
    </MemoryRouter>
  )
}

function screen(wide: boolean): void {
  vi.stubGlobal('window', {
    matchMedia: () => ({
      matches: wide,
      addEventListener: () => {},
      removeEventListener: () => {}
    })
  })
}

/** As classes da célula da grade que contém o marcador. */
function cellOf(html: string, marker: string): string {
  const at = html.indexOf(marker)
  const open = html.lastIndexOf('<div class="', at)
  return html.slice(open, html.indexOf('>', open))
}

describe('ServerView', () => {
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    useVoiceChatPanelStore.setState({ channelId: null })
    useAuthStore.setState({ user: { id: 'ana', username: 'ana' } as never })
    useSearchStore.setState({ scope: null })
    useServerStore.setState({
      loading: false,
      currentServer: { id: 's1', name: 'Salinha', owner_id: 'dono' } as never,
      currentMembers: [{ user_id: 'ana', role_ids: [] }] as never,
      roles: [
        {
          id: 'everyone',
          name: '@everyone',
          position: 0,
          permissions: DEFAULT_EVERYONE,
          is_default: true
        }
      ] as never,
      channels: [
        { id: 't1', server_id: 's1', name: 'geral', type: 'text' },
        { id: 'v1', server_id: 's1', name: 'Resenha', type: 'voice' }
      ] as never
    })
  })

  it('carregando: o esqueleto da tela, com a lista de membros', () => {
    useServerStore.setState({ loading: true })
    const html = render()
    expect(html).toContain('Carregando servidor…')
    expect(html).toContain('data-membros-esqueleto')
  })

  it('celular: a barra tem "voltar para a lista" e o botão da gaveta de membros', () => {
    screen(false)
    const html = render()
    expect(html).toContain('aria-label="Voltar para canais e conversas"')
    expect(html).toContain('aria-label="Membros"')
  })

  it('a barra de cima atravessa o conteúdo e a coluna de membros; a busca fica sobre ela', () => {
    const html = render()
    expect(html).toContain('data-coluna-direita="members"')
    expect(html).toMatch(/<header class="col-span-2[^"]*grid-cols-subgrid/)
    expect(cellOf(html, 'data-busca')).toContain('lg:contain-inline-size')
    expect(cellOf(html, 'data-membros=""')).toContain('row-start-2')
  })

  it('chat da call aberto (tela larga): toma a coluna da direita de cima a baixo, sem membros', () => {
    screen(true)
    useVoiceChatPanelStore.setState({ channelId: 'v1' })
    const html = render('/servers/s1/channels/v1')
    expect(html).toContain('data-coluna-direita="voiceChat"')
    expect(cellOf(html, 'data-chat-call="v1"')).toContain('row-span-2')
    expect(html).toMatch(/<header class="col-start-1/)
    expect(html).not.toContain('data-membros=""')
  })

  it('chat da call em tela estreita: sobreposição, a grade continua com membros', () => {
    screen(false)
    useVoiceChatPanelStore.setState({ channelId: 'v1' })
    const html = render('/servers/s1/channels/v1')
    expect(html).toContain('data-coluna-direita="members"')
    expect(html).toContain('data-chat-call="v1"')
    expect(html).toContain('data-membros=""')
  })

  it('chat de um canal de voz aberto, mas na tela de um canal de texto: só membros', () => {
    screen(true)
    useVoiceChatPanelStore.setState({ channelId: 'v1' })
    const html = render()
    expect(html).toContain('data-coluna-direita="members"')
    expect(html).not.toContain('data-chat-call')
  })

  it('canal de texto: barra com título, ações e busca; conteúdo; membros e convite', () => {
    const html = render()
    expect(html).toContain('<h1>geral</h1>')
    expect(html).toContain('data-acoes="texto" data-convida="true"')
    expect(html).toContain('data-busca')
    expect(html).toContain('data-conteudo="t1" data-tipo="text"')
    expect(html).toContain('data-membros=""')
    expect(html).toContain('data-convite')
    expect(html).not.toContain('data-resultados')
  })

  it('canal de voz: as ações sabem que é voz', () => {
    const html = render('/servers/s1/channels/v1')
    expect(html).toContain('data-acoes="voz"')
    expect(html).toContain('data-conteudo="v1" data-tipo="voice"')
  })

  it('com a busca do servidor aberta, os resultados tomam o lugar dos membros', () => {
    useSearchStore.setState({ scope: { kind: 'server', id: 's1' } })
    const html = render()
    expect(html).toContain('data-resultados')
    expect(html).not.toContain('data-membros=""')
  })

  it('sem canal e sem nenhum de texto: boas-vindas do servidor', () => {
    useServerStore.setState({ channels: [] })
    expect(render('/servers/s1')).toContain('data-conteudo="boas-vindas"')
  })
})
