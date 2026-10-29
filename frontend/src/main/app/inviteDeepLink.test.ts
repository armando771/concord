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

  it('link https de convite nosso, clicado no app, também fica guardado', () => {
    const pending = new PendingInvite()
    expect(
      pending.offerWebUrl('https://app-salinha.bhrx.com.br/convite/K7P2QX9M', [undefined])
    ).toBe(true)
    expect(pending.take()).toBe('K7P2QX9M')
    expect(
      pending.offerWebUrl('https://1-2-3-4.sslip.io/convite/ABCD2345', ['https://1-2-3-4.sslip.io'])
    ).toBe(true)
    expect(pending.take()).toBe('ABCD2345')
  })

  it('link https de outro host ou sem convite não é guardado', () => {
    const pending = new PendingInvite()
    expect(pending.offerWebUrl('https://exemplo.com/convite/K7P2QX9M', [])).toBe(false)
    expect(pending.offerWebUrl('https://app-salinha.bhrx.com.br/servers/1', [])).toBe(false)
    expect(pending.take()).toBeNull()
  })
})
