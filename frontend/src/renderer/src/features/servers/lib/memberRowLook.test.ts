import { describe, expect, it } from 'vitest'
import { memberRowLook } from './memberRowLook'

const me = { id: 'eu', display_name: 'Eu Mesmo', username: 'eu' }
const online = { me, offline: false }

describe('memberRowLook', () => {
  it('usa o nome de exibição e o @ do membro', () => {
    const look = memberRowLook({ user_id: 'ana', display_name: 'Ana', username: 'ana' }, online)
    expect(look).toEqual({
      displayName: 'Ana',
      handle: 'ana',
      colorClass: 'bg-indigo-600',
      nameClass: 'text-gray-200'
    })
  })

  it('sem nome de exibição, cai no @', () => {
    expect(memberRowLook({ user_id: 'bia', username: 'bia' }, online).displayName).toBe('bia')
  })

  it('sem nome nem @: sendo eu, usa os meus dados', () => {
    const look = memberRowLook({ user_id: 'eu' }, online)
    expect(look.displayName).toBe('Eu Mesmo')
    expect(look.handle).toBe('eu')
  })

  it('sem nome nem @ de outra pessoa: "Membro" e "membro"', () => {
    const look = memberRowLook({ user_id: 'x' }, { ...online, me: null })
    expect(look.displayName).toBe('Membro')
    expect(look.handle).toBe('membro')
  })

  // Issue #332: o dono não tem cor própria; vale a do cargo, como para todos.
  it('o dono online tem a cor de reserva de qualquer membro', () => {
    const look = memberRowLook({ user_id: 'dono', username: 'dono' }, online)
    expect(look.colorClass).toBe('bg-indigo-600')
    expect(look.nameClass).toBe('text-gray-200')
  })

  it('offline fica cinza, mesmo sendo o dono', () => {
    const look = memberRowLook({ user_id: 'dono', username: 'dono' }, { ...online, offline: true })
    expect(look.colorClass).toBe('bg-gray-600')
    expect(look.nameClass).toBe('text-gray-400')
  })
})
