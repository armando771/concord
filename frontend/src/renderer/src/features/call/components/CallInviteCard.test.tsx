import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ validity: 'valid', busy: false }))

vi.mock('../../../shared/ui/Avatar', () => ({
  default: ({ name }: { name: string }) => <span data-avatar={name} />
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { id: 'me' } })
}))
vi.mock('../store/inviteValidityStore', () => ({
  useInviteValidity: () => state.validity,
  useInviteValidityStore: { getState: () => ({ ensure: vi.fn() }) }
}))
vi.mock('../hooks/useOpenCallInvite', () => ({
  useOpenCallInvite: () => ({ busy: state.busy, open: vi.fn() })
}))

import type { Message } from '../../chat/api/messages'
import CallInviteCard from './CallInviteCard'

const message = (authorId: string): Message => ({
  id: 'm1',
  author_id: authorId,
  author: { id: authorId, username: 'ana', display_name: 'Ana' },
  conversation_id: 'dm1',
  content: 'Convidou você para a call',
  call_invite: {
    call_id: 'call-1',
    channel_id: 'ch1',
    server_id: 's1',
    channel_name: 'Geral',
    server_name: 'Salinha'
  },
  created_at: '2026-10-27T12:00:00Z'
})

const render = (m: Message): string => renderToStaticMarkup(<CallInviteCard message={m} />)

beforeEach(() => {
  state.validity = 'valid'
  state.busy = false
})

describe('CallInviteCard', () => {
  it('convidado: lugar, texto, avatar de quem convidou e botão Abrir de 40 px', () => {
    const html = render(message('ana-id'))
    expect(html).toContain('Salinha - Geral')
    expect(html).toContain('Ana convidou você para a call')
    expect(html).toContain('data-avatar="Ana"')
    expect(html).toContain('>Abrir<')
    expect(html).toContain('min-h-10')
    expect(html).toContain('w-full')
  })

  it('quem convidou vê o cartão sem botão', () => {
    const html = render(message('me'))
    expect(html).toContain('Você convidou para a call')
    expect(html).not.toContain('Abrir')
    expect(html).not.toContain('<button')
  })

  it('enquanto confere a call o botão fica desligado', () => {
    state.validity = 'unknown'
    expect(render(message('ana-id'))).toMatch(/<button[^>]*disabled/)
  })

  it('abrindo (em andamento) o botão também fica desligado', () => {
    state.busy = true
    expect(render(message('ana-id'))).toMatch(/<button[^>]*disabled/)
  })

  it('call acabou: cartão cinza, "Convite inválido" em vermelho e sem botão', () => {
    state.validity = 'invalid'
    for (const author of ['ana-id', 'me']) {
      const html = render(message(author))
      expect(html).toContain('Convite inválido')
      expect(html).toContain('Peça um novo convite')
      expect(html).toContain('text-danger')
      expect(html).not.toContain('<button')
      expect(html).not.toContain('Abrir')
    }
  })

  it('mensagem sem convite não renderiza nada', () => {
    expect(render({ ...message('ana-id'), call_invite: null })).toBe('')
  })
})
