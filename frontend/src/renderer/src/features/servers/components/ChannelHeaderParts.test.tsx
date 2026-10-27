import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../chat/components/PinnedMessagesPopover', () => ({
  default: (p: { channelId: string; canModerate: boolean }) => (
    <div data-fixadas={p.channelId} data-modera={String(p.canModerate)} />
  )
}))
vi.mock('../../chat/components/MessageSearchBar', () => ({
  default: (p: {
    name: string
    users: { id: string; displayName: string }[]
    channels: { id: string }[]
  }) => (
    <div
      data-busca={p.name}
      data-pessoas={p.users.map((u) => `${u.id}:${u.displayName}`).join(',')}
      data-canais={p.channels.map((c) => c.id).join(',')}
    />
  )
}))

// SSR lê o estado atual do zustand (mesmo truque do ImageContextMenu.test).
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) =>
  getSnapshot()
)

import { useServerStore } from '../store/serverStore'
import { ChannelActions, ChannelTitle, ServerSearch } from './ChannelHeaderParts'

const noop = (): void => {}

function actions(over: Partial<React.ComponentProps<typeof ChannelActions>> = {}): string {
  return renderToStaticMarkup(
    <ChannelActions
      channelId="c1"
      isVoice={false}
      pinsOpen={false}
      onTogglePins={noop}
      onClosePins={noop}
      canInvite
      onInvite={noop}
      canModerate={false}
      {...over}
    />
  )
}

describe('ChannelTitle', () => {
  it('canal de texto: # e o nome', () => {
    const html = renderToStaticMarkup(
      <ChannelTitle channel={{ name: 'geral', type: 'text' } as never} fallback="Salinha" />
    )
    expect(html).toContain('>#</span>')
    expect(html).toContain('title="geral"')
  })

  it('canal de voz: alto-falante; sem canal, o nome do servidor', () => {
    const voice = renderToStaticMarkup(
      <ChannelTitle channel={{ name: 'Resenha', type: 'voice' } as never} fallback="Salinha" />
    )
    expect(voice).not.toContain('>#</span>')
    expect(voice).toContain('<svg')
    expect(renderToStaticMarkup(<ChannelTitle channel={undefined} fallback="Salinha" />)).toContain(
      'title="Salinha"'
    )
  })
})

describe('ChannelActions', () => {
  it('canal de texto: fixadas e Convidar', () => {
    const html = actions()
    expect(html).toContain('title="Mensagens Fixadas"')
    expect(html).toContain('Convidar')
    expect(html).not.toContain('data-fixadas')
  })

  it('sem permissão de convidar, sem o botão; canal de voz, sem fixadas', () => {
    const html = actions({ canInvite: false, isVoice: true })
    expect(html).not.toContain('Convidar')
    expect(html).not.toContain('Mensagens Fixadas')
  })

  it('fixadas abertas: botão aceso e o popover do canal', () => {
    const html = actions({ pinsOpen: true, canModerate: true })
    expect(html).toContain('border-amber-500/50')
    expect(html).toContain('data-fixadas="c1" data-modera="true"')
  })
})

describe('ServerSearch', () => {
  it('busca no servidor com as pessoas e só os canais de texto dele', () => {
    useServerStore.setState({
      currentMembers: [
        { user_id: 'u1', username: 'ana', display_name: 'Ana' },
        { user_id: 'u2', username: 'bia' },
        { user_id: 'u3' }
      ] as never,
      channels: [
        { id: 't1', server_id: 's1', name: 'geral' },
        { id: 'v1', server_id: 's1', name: 'Resenha', type: 'voice' },
        { id: 'x1', server_id: 's2', name: 'outro', type: 'text' }
      ] as never
    })
    const html = renderToStaticMarkup(
      <ServerSearch server={{ id: 's1', name: 'Salinha' } as never} />
    )
    expect(html).toContain('data-busca="Salinha"')
    expect(html).toContain('data-pessoas="u1:Ana,u2:bia"')
    expect(html).toContain('data-canais="t1"')
  })
})
