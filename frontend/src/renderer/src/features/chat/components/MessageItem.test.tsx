import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// SSR lê o estado atual do zustand (mesmo truque do ImageContextMenu.test).
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) =>
  getSnapshot()
)

// O player de música puxa o áudio da chamada (AudioWorklet), que não existe no Node.
vi.mock('../../music/components/MusicMessage', () => ({
  default: () => <div data-music="" />
}))
vi.mock('../../call/lib/noiseSuppression', () => ({ openMicrophone: vi.fn() }))
vi.mock('../../call/lib/rtc', () => ({}))
vi.mock('../../../app/router', () => ({
  default: { navigate: vi.fn(), state: { location: { pathname: '/' } } }
}))

import type { Message } from '../api/messages'
import { useAuthStore } from '../../auth/store/authStore'
import { useFriendStore } from '../../friends/store/friendStore'
import MessageItem, { type MessageItemProps } from './MessageItem'

const noop = (): void => {}
const asyncNoop = async (): Promise<void> => {}

function msg(over: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    author_id: 'bia',
    author: { username: 'bia', display_name: 'Bia' } as Message['author'],
    content: 'olá pessoal',
    created_at: '2026-01-01T10:00:00Z',
    ...over
  }
}

function render(message: Message, over: Partial<MessageItemProps> = {}): string {
  return renderToStaticMarkup(
    <MessageItem
      message={message}
      isHighlighted={false}
      onReply={noop}
      onReact={noop}
      onJumpToMessage={noop}
      onDelete={noop}
      onVote={asyncNoop}
      onEndPoll={asyncNoop}
      onCopy={noop}
      onStartEdit={noop}
      onSaveEdit={noop}
      onCancelEdit={noop}
      isEditing={false}
      savingEdit={false}
      canReact
      canModerate={false}
      {...over}
    />
  )
}

describe('MessageItem', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'ana', username: 'ana', display_name: 'Ana' } as never })
    useFriendStore.setState({ blocked: [] })
  })

  it('linha comum: avatar, nome, hora e texto', () => {
    const html = render(msg())
    expect(html).toContain('id="msg-m1"')
    expect(html).toContain('Perfil de Bia')
    expect(html).toContain('olá pessoal')
    expect(html).toContain('py-1.5')
  })

  it('agrupada: sem avatar, só os selos (editada, fixada)', () => {
    const html = render(
      msg({ edited_at: '2026-01-01T10:05:00Z', pinned_at: '2026-01-01T10:06:00Z' }),
      { grouped: true }
    )
    expect(html).not.toContain('Perfil de Bia')
    expect(html).toContain('(editada)')
    expect(html).toContain('fixada')
    expect(html).toContain('py-0.5')
  })

  it('mensagem /tts leva o selo de alto-falante', () => {
    expect(render(msg({ tts: true }))).toContain('Mensagem TTS')
    expect(render(msg())).not.toContain('Mensagem TTS')
    expect(render(msg({ tts: true }), { grouped: true })).toContain('Mensagem TTS')
  })

  it('resposta a uma mensagem apagada mostra o aviso da original', () => {
    expect(render(msg({ reply_to_id: 'x' }))).toContain('Mensagem original foi excluída')
  })

  it('reações viram chips com a contagem', () => {
    const html = render(msg({ reactions: [{ emoji: '🔥', count: 3, user_ids: ['a', 'b', 'c'] }] }))
    expect(html).toContain('🔥')
    expect(html).toContain('>3<')
  })

  it('figurinha que não veio mostra "Figurinha indisponível"', () => {
    expect(render(msg({ content: '', sticker_id: 's1' }))).toContain('Figurinha indisponível')
  })

  it('autor bloqueado: a mensagem fica escondida', () => {
    useFriendStore.setState({ blocked: [{ id: 'bia' } as never] })
    const html = render(msg())
    expect(html).toContain('1 mensagem bloqueada')
    expect(html).not.toContain('olá pessoal')
  })

  it('mensagem de sistema não vira linha de autor', () => {
    const html = render(msg({ system_kind: 'birthday', content: 'Feliz aniversário' }))
    expect(html).not.toContain('Perfil de Bia')
    expect(html).toContain('Feliz aniversário')
  })

  it('mensagem da música vai para o card de música', () => {
    expect(render(msg({ system_kind: 'music' }))).toContain('data-music')
  })

  it('a lista de comandos fixada no #musica também vai para o card do Maestro', () => {
    expect(render(msg({ system_kind: 'music_commands' }))).toContain('data-music')
  })

  it('em edição mostra o editor no lugar do texto', () => {
    const html = render(msg({ author_id: 'ana' }), { isEditing: true })
    expect(html).toContain('<textarea')
  })
})
