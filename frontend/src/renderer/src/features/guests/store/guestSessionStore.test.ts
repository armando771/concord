import { beforeEach, describe, expect, it } from 'vitest'
import { anonymousGuestLink, useGuestSessionStore } from './guestSessionStore'
import type { GuestPass } from '../api/guestInvites'

const pass: GuestPass = {
  server_id: 's',
  server_name: 'Salinha',
  channel_id: 'c',
  channel_name: 'Sala',
  expires_at: '2026-10-28T14:00:00Z',
  can_speak: true,
  can_stream: false
}

describe('sessão de visitante', () => {
  beforeEach(() => useGuestSessionStore.getState().clear())

  it('guarda o link e o acesso ao entrar', () => {
    useGuestSessionStore.getState().start('tok', pass, true)
    const s = useGuestSessionStore.getState()
    expect(s.link).toBe('tok')
    expect(anonymousGuestLink(s)).toBe('tok')
  })

  it('o aviso guest:ended encerra com o motivo', () => {
    useGuestSessionStore.getState().start('tok', pass, true)
    useGuestSessionStore
      .getState()
      .handleWsEvent({ type: 'guest:ended', payload: { reason: 'revoked' } })
    expect(useGuestSessionStore.getState().ended).toBe('revoked')
    expect(anonymousGuestLink(useGuestSessionStore.getState())).toBeNull()
  })

  it('ignora outros eventos e conta com motivo padrão', () => {
    useGuestSessionStore.getState().handleWsEvent({ type: 'call:joined', payload: {} })
    expect(useGuestSessionStore.getState().ended).toBeNull()
    useGuestSessionStore.getState().handleWsEvent({ type: 'guest:ended', payload: null })
    expect(useGuestSessionStore.getState().ended).toBe('removed')
  })

  it('conta logada não é sessão anônima', () => {
    useGuestSessionStore.getState().start('tok', pass, false)
    expect(anonymousGuestLink(useGuestSessionStore.getState())).toBeNull()
  })
})
