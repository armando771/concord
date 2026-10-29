import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// ChatPane e a tela da chamada são pesados: aqui importa qual aparece e com o quê.
vi.mock('../../chat/components/ChatPane', () => ({
  default: (p: { room: string; placeholder: string; canDeleteMessages: boolean }) => (
    <div data-chat={p.room} data-placeholder={p.placeholder} data-apaga={String(p.canDeleteMessages)} />
  )
}))
vi.mock('../../call/components/VoiceChannelView', () => ({
  default: ({ channelId }: { channelId: string }) => <div data-voz={channelId} />
}))

// SSR lê o estado atual do zustand (mesmo truque do ImageContextMenu.test).
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) =>
  getSnapshot()
)

import { chatPermissionsFor } from '../../chat/lib/chatPermissions'
import ServerChannelContent from './ServerChannelContent'

const server = { id: 's1', name: 'Salinha' } as never
const permissions = chatPermissionsFor(0)

function render(channelId: string | undefined, channel?: Record<string, unknown>): string {
  return renderToStaticMarkup(
    <ServerChannelContent
      server={server}
      channelId={channelId}
      channel={channel as never}
      permissions={permissions}
    />
  )
}

describe('ServerChannelContent', () => {
  it('sem canal: boas-vindas do servidor', () => {
    expect(render(undefined)).toContain('Bem-vindo a #Salinha!')
  })

  it('canal de voz: a tela da chamada', () => {
    expect(render('v1', { id: 'v1', name: 'Resenha', type: 'voice' })).toContain('data-voz="v1"')
  })

  it('canal de texto: o chat do canal', () => {
    const html = render('t1', { id: 't1', name: 'geral', type: 'text' })
    expect(html).toContain('data-chat="channel:t1"')
    expect(html).toContain('data-placeholder="Mensagem para #geral"')
    expect(html).toContain('data-apaga="true"')
  })

  it('canal do sistema não apaga mensagens; canal ainda carregando vira "canal"', () => {
    expect(render('t1', { id: 't1', name: 'avisos', is_system: true })).toContain('data-apaga="false"')
    expect(render('t1')).toContain('data-placeholder="Mensagem para #canal"')
  })
})
