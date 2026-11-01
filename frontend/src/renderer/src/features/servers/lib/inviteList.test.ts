import { describe, expect, it } from 'vitest'
import {
  acceptLabel,
  formatInviteDate,
  inviteSubtitle,
  pendingInvitesLabel,
  serverInitial
} from './inviteList'

describe('acceptLabel', () => {
  it('troca o rótulo enquanto entra', () => {
    expect(acceptLabel(false)).toBe('Aceitar')
    expect(acceptLabel(true)).toBe('Entrando...')
  })
})

describe('formatInviteDate', () => {
  it('sem data, vazio', () => {
    expect(formatInviteDate()).toBe('')
    expect(formatInviteDate('')).toBe('')
  })
  it('formata em português', () => {
    expect(formatInviteDate('2026-10-26T12:00:00Z')).toMatch(/26.*2026/)
  })
})

describe('inviteSubtitle', () => {
  it('diz quem convidou', () => {
    expect(inviteSubtitle({ inviter_username: 'ana' })).toBe('@ana convidou você')
  })
  it('acrescenta a data quando existe', () => {
    const text = inviteSubtitle({ inviter_username: 'ana', created_at: '2026-10-26T12:00:00Z' })
    expect(text).toMatch(/^@ana convidou você • .*2026/)
  })
})

describe('serverInitial', () => {
  it('primeira letra maiúscula', () => {
    expect(serverInitial('brothers')).toBe('B')
  })
  it('sem nome, interrogação', () => {
    expect(serverInitial()).toBe('?')
  })
})

describe('pendingInvitesLabel', () => {
  it('mostra a contagem depois de carregar', () => {
    expect(pendingInvitesLabel(false, 3)).toBe('Convites pendentes — 3')
  })
  it('carregando, sem número', () => {
    expect(pendingInvitesLabel(true, 0)).toBe('Convites pendentes')
  })
})
