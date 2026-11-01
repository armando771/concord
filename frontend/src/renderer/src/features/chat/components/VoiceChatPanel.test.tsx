import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// O ChatPane (lista + campo) é o mesmo do canal de texto: aqui importa o que ele recebe.
vi.mock('./ChatPane', () => ({
  default: (props: {
    room: string
    serverId?: string
    placeholder?: string
    permissions: { canSend: boolean }
  }) => (
    <div
      data-room={props.room}
      data-server={props.serverId}
      data-placeholder={props.placeholder}
      data-pode-enviar={String(props.permissions.canSend)}
    />
  )
}))
// SSR não tem portal: na tela estreita o painel vai direto para a saída.
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => <div data-portal="">{node}</div>
}))

// SSR lê o estado atual do zustand (mesmo truque do ImageContextMenu.test).
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) =>
  getSnapshot()
)

import { useAuthStore } from '../../auth/store/authStore'
import { useServerStore } from '../../servers/store/serverStore'
import { Perm } from '../../servers/lib/permissions'
import VoiceChatPanel from './VoiceChatPanel'

function screen(wide: boolean): void {
  vi.stubGlobal('window', {
    matchMedia: () => ({
      matches: wide,
      addEventListener: () => {},
      removeEventListener: () => {}
    })
  })
}

function setServer(everyonePerms: number): void {
  useServerStore.setState({
    currentServer: { id: 's1', owner_id: 'dono' } as never,
    currentMembers: [{ user_id: 'eu', role_ids: [], username: 'eu' }] as never,
    roles: [
      { id: 'r0', name: '@everyone', position: 0, permissions: everyonePerms, is_default: true }
    ] as never,
    channels: [
      { id: 'v1', server_id: 's1', name: 'Resenha', type: 'voice', overwrites: [] }
    ] as never
  })
}

describe('VoiceChatPanel', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'eu', username: 'eu' } as never })
    setServer(Perm.VIEW_CHANNEL | Perm.READ_MESSAGE_HISTORY | Perm.SEND_MESSAGES | Perm.CONNECT)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('tela larga: coluna ao lado da chamada com o chat do canal de voz', () => {
    screen(true)
    const html = renderToStaticMarkup(<VoiceChatPanel channelId="v1" />)
    expect(html).toContain('aria-label="Chat de Resenha"')
    expect(html).toContain('>Resenha</h2>')
    expect(html).toContain('aria-label="Fechar chat"')
    expect(html).toContain('data-room="channel:v1"')
    expect(html).toContain('data-server="s1"')
    expect(html).toContain('data-placeholder="Mensagem para Resenha"')
    expect(html).toContain('data-pode-enviar="true"')
    expect(html).toContain('border-l')
    expect(html).not.toContain('data-portal')
  })

  it('tela estreita: por cima de tudo, em tela cheia', () => {
    screen(false)
    vi.stubGlobal('document', { body: {} })
    const html = renderToStaticMarkup(<VoiceChatPanel channelId="v1" />)
    expect(html).toContain('data-portal')
    expect(html).toContain('fixed inset-0 z-50')
  })

  it('sem enviar mensagens no canal de voz, o chat fica só de leitura', () => {
    screen(true)
    setServer(Perm.VIEW_CHANNEL | Perm.READ_MESSAGE_HISTORY | Perm.CONNECT)
    expect(renderToStaticMarkup(<VoiceChatPanel channelId="v1" />)).toContain(
      'data-pode-enviar="false"'
    )
  })
})
