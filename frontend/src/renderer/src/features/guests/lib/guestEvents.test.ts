import { describe, expect, it } from 'vitest'
import { guestEventAction, visitEndedMessage } from './guestEvents'

const pass = {
  server_id: 's',
  server_name: 'BH RX',
  channel_id: 'c',
  channel_name: 'Sala',
  expires_at: '2026-10-28T14:00:00Z',
  can_speak: true,
  can_stream: false
}

describe('eventos de visitante (WS)', () => {
  it('guest:pass atualiza a visita', () => {
    expect(guestEventAction({ type: 'guest:pass', payload: pass })).toEqual({ kind: 'pass', pass })
    expect(guestEventAction({ type: 'guest:pass', payload: null })).toBeNull()
  })

  it('guest:ended traz o servidor e o motivo (padrão: removido)', () => {
    expect(
      guestEventAction({ type: 'guest:ended', payload: { server_id: 's', reason: 'expired' } })
    ).toEqual({ kind: 'ended', serverId: 's', reason: 'expired' })
    expect(guestEventAction({ type: 'guest:ended', payload: {} })).toEqual({
      kind: 'ended',
      serverId: '',
      reason: 'removed'
    })
  })

  it('guest:refused vira aviso (sem derrubar a call)', () => {
    expect(
      guestEventAction({ type: 'guest:refused', payload: { message: 'Não pode.' } })
    ).toEqual({ kind: 'refused', message: 'Não pode.' })
  })

  it('outros eventos não são de visitante', () => {
    expect(guestEventAction({ type: 'guest:outro', payload: {} })).toBeNull()
  })

  it('aviso curto do fim da visita, com o servidor', () => {
    expect(visitEndedMessage('BH RX', 'expired')).toBe('Sua visita em BH RX terminou.')
    expect(visitEndedMessage('BH RX', 'revoked')).toBe(
      'O link de visitante de BH RX foi revogado.'
    )
    expect(visitEndedMessage('BH RX', 'removed')).toBe('Você foi removido da call em BH RX.')
    expect(visitEndedMessage(null, 'expired')).toBe('Sua visita terminou.')
  })
})
