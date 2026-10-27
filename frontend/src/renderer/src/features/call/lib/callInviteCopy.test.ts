import { describe, expect, it } from 'vitest'
import { inviteNotification, resultText, updateText } from './callInviteCopy'

describe('inviteNotification', () => {
  it('título com quem convidou e rota do canal', () => {
    const n = inviteNotification({
      by: { display_name: 'Ana', username: 'ana' },
      server_id: 's1',
      channel_id: 'c1'
    })
    expect(n.title).toBe('Ana te convidou para a call')
    expect(n.route).toBe('/servers/s1/channels/c1')
  })

  it('sem canal vai para a raiz e sem nome usa o usuário', () => {
    const n = inviteNotification({ by: { username: 'ana' } })
    expect(n.title).toContain('ana')
    expect(n.route).toBe('/')
  })
})

describe('textos de status', () => {
  it('conhece os status e tem fallback', () => {
    expect(resultText('offline')).toBe('Está offline')
    expect(resultText('x')).toBe('Não foi possível convidar')
    expect(updateText('expired')).toBe('O convite expirou')
    expect(updateText('x')).toBe('')
  })
})
