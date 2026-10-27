import { describe, expect, it } from 'vitest'
import type { Message } from '../api/messages'
import {
  authorFallbackName,
  hasReplyReference,
  messageBarActions,
  messageRowClass,
  stickerUnavailable
} from './messageItem'

const msg = (over: Partial<Message> = {}): Message => ({
  id: 'm1',
  author_id: 'ana',
  content: 'oi',
  created_at: '2026-01-01T10:00:00Z',
  ...over
})

describe('authorFallbackName', () => {
  it('usa o nome de exibição, depois o username da mensagem', () => {
    const author = { username: 'ana_u', display_name: 'Ana' } as Message['author']
    expect(authorFallbackName(msg({ author }), null)).toBe('Ana')
    expect(
      authorFallbackName(msg({ author: { username: 'ana_u' } as Message['author'] }), null)
    ).toBe('ana_u')
  })

  it('mensagem minha sem autor: meu nome; de outro: "Desconhecido"', () => {
    expect(authorFallbackName(msg(), { id: 'ana', display_name: 'Eu' })).toBe('Eu')
    expect(authorFallbackName(msg(), { id: 'bia', display_name: 'Bia' })).toBe('Desconhecido')
    expect(authorFallbackName(msg(), null)).toBe('Desconhecido')
  })
})

describe('hasReplyReference', () => {
  it('vale com o id ou com a prévia da original', () => {
    expect(hasReplyReference(msg())).toBe(false)
    expect(hasReplyReference(msg({ reply_to_id: 'x' }))).toBe(true)
    expect(hasReplyReference(msg({ reply_to: { id: 'x' } as Message['reply_to'] }))).toBe(true)
  })
})

describe('stickerUnavailable', () => {
  it('figurinha carregada ou mensagem com conteúdo: sem aviso', () => {
    expect(stickerUnavailable(msg({ sticker: { id: 's' } as Message['sticker'] }))).toBe(false)
    expect(stickerUnavailable(msg())).toBe(false)
    expect(stickerUnavailable(msg({ content: '', gif_url: 'https://g' }))).toBe(false)
    expect(stickerUnavailable(msg({ content: '', system_kind: 'birthday' }))).toBe(false)
  })

  it('figurinha que não veio, ou mensagem vazia: aviso', () => {
    expect(stickerUnavailable(msg({ sticker_id: 's' }))).toBe(true)
    expect(stickerUnavailable(msg({ content: '' }))).toBe(true)
  })
})

describe('messageRowClass', () => {
  it('agrupada fica mais junta; menção ganha a borda; pulo ganha o pulso', () => {
    expect(messageRowClass(true, false, false)).toContain('py-0.5')
    expect(messageRowClass(false, false, false)).toContain('py-1.5')
    expect(messageRowClass(false, true, false)).toContain('border-warning')
    expect(messageRowClass(false, false, true)).toContain('msg-jump-highlight')
    expect(messageRowClass(false, false, false)).not.toContain('msg-jump-highlight')
  })
})

describe('messageBarActions', () => {
  const handlers = { onCopy: () => {}, onStartEdit: () => {}, onDelete: () => {} }
  const base = { meId: 'ana', isEditing: false, canDelete: true, canModerate: false }

  it('minha mensagem: copiar, editar e excluir', () => {
    const actions = messageBarActions({ ...base, message: msg() }, handlers)
    expect(actions.onCopy).toBe(handlers.onCopy)
    expect(actions.onEdit).toBe(handlers.onStartEdit)
    expect(actions.onDelete).toBe(handlers.onDelete)
    expect(actions.deleteTitle).toBe('Excluir mensagem')
  })

  it('de outra pessoa: sem editar; excluir só com moderação', () => {
    const other = msg({ author_id: 'bia' })
    const plain = messageBarActions({ ...base, message: other }, handlers)
    expect(plain.onEdit).toBeUndefined()
    expect(plain.onDelete).toBeUndefined()
    const mod = messageBarActions({ ...base, canModerate: true, message: other }, handlers)
    expect(mod.onDelete).toBe(handlers.onDelete)
    expect(mod.deleteTitle).toBe('Excluir mensagem (moderação)')
  })

  it('sem texto não copia; já editando não edita; canal de sistema não exclui', () => {
    expect(
      messageBarActions({ ...base, message: msg({ content: '' }) }, handlers).onCopy
    ).toBeUndefined()
    expect(
      messageBarActions({ ...base, isEditing: true, message: msg() }, handlers).onEdit
    ).toBeUndefined()
    expect(
      messageBarActions({ ...base, canDelete: false, message: msg() }, handlers).onDelete
    ).toBeUndefined()
  })
})
