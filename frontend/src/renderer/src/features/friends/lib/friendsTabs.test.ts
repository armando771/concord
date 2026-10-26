import { describe, expect, it } from 'vitest'
import { addTabClass, parseFriendsTab, tabBadge, tabClass, tabHasSearch } from './friendsTabs'

describe('classes das abas', () => {
  it('aba ativa destacada, inativa discreta', () => {
    expect(tabClass(true)).toContain('text-strong')
    expect(tabClass(false)).toContain('text-gray-400')
  })
  it('"Adicionar amigo" é verde cheio fechado e texto verde aberto', () => {
    expect(addTabClass(false)).toContain('bg-success-strong')
    expect(addTabClass(true)).toContain('text-success')
  })
})

describe('parseFriendsTab', () => {
  it('aceita as abas conhecidas, inclusive convites', () => {
    expect(parseFriendsTab('pending')).toBe('pending')
    expect(parseFriendsTab('invites')).toBe('invites')
  })
  it('ignora o desconhecido e o vazio', () => {
    expect(parseFriendsTab('nada')).toBeNull()
    expect(parseFriendsTab(null)).toBeNull()
  })
})

describe('tabHasSearch', () => {
  it('só as abas de pessoas têm busca', () => {
    expect(tabHasSearch('online')).toBe(true)
    expect(tabHasSearch('blocked')).toBe(true)
    expect(tabHasSearch('add')).toBe(false)
    expect(tabHasSearch('invites')).toBe(false)
  })
})

describe('tabBadge', () => {
  const counts = { pending: 2, invites: 5 }
  it('pendente mostra os pedidos recebidos', () => {
    expect(tabBadge('pending', counts)).toBe(2)
  })
  it('convites mostra os convites de servidor', () => {
    expect(tabBadge('invites', counts)).toBe(5)
  })
  it('as outras abas ficam sem selo', () => {
    expect(tabBadge('online', counts)).toBe(0)
  })
})
