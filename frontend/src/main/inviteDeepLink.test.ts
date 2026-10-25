import { describe, expect, it } from 'vitest'
import { PendingInvite } from './inviteDeepLink'

describe('PendingInvite', () => {
  it('guarda o convite dos args até o renderer buscar (uma vez só)', () => {
    const pending = new PendingInvite()
    expect(pending.offerArgs(['Salinha.exe', 'salinha://convite/K7P2QX9M'])).toBe(true)
    expect(pending.take()).toBe('K7P2QX9M')
    expect(pending.take()).toBeNull()
  })

  it('ignora args sem convite (autostart --hidden) e links malformados', () => {
    const pending = new PendingInvite()
    expect(pending.offerArgs(['Salinha.exe', '--hidden'])).toBe(false)
    expect(pending.offerUrl('salinha://convite/K7P2QX9M?roubar=1')).toBe(false)
    expect(pending.offerUrl('salinha://outra-coisa')).toBe(false)
    expect(pending.take()).toBeNull()
  })

  it('o convite mais novo vence (dois cliques antes do app carregar)', () => {
    const pending = new PendingInvite()
    pending.offerUrl('salinha://convite/AAAA2222')
    pending.offerArgs(['Salinha.exe', 'salinha://convite/BBBB3333'])
    expect(pending.take()).toBe('BBBB3333')
  })
})
