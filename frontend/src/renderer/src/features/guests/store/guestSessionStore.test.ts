import { beforeEach, describe, expect, it } from 'vitest'
import { anonymousGuestLink, migrateGuestSession, useGuestSessionStore } from './guestSessionStore'
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
    useGuestSessionStore.getState().start('tok', pass)
    const s = useGuestSessionStore.getState()
    expect(s.link).toBe('tok')
    expect(anonymousGuestLink(s)).toBe('tok')
  })

  it('sair ou o fim do acesso encerram a sessão', () => {
    useGuestSessionStore.getState().start('tok', pass)
    useGuestSessionStore.getState().end('left')
    expect(useGuestSessionStore.getState().ended).toBe('left')
    expect(anonymousGuestLink(useGuestSessionStore.getState())).toBeNull()
  })

  it('a sessão salva de quem tinha conta (versão antiga) some; a do visitante fica', () => {
    const old = { link: 'tok', anonymous: false, pass, ended: null }
    expect(migrateGuestSession(old, 0)).toEqual({
      link: null,
      anonymous: false,
      pass: null,
      ended: null
    })
    const anon = { ...old, anonymous: true }
    expect(migrateGuestSession(anon, 0)).toBe(anon)
    expect(migrateGuestSession(null, 0)).toEqual(expect.objectContaining({ link: null }))
  })
})
