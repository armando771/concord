import { describe, expect, it } from 'vitest'
import { cardView, invitePlace } from './callInviteCard'

const invite = {
  call_id: 'c1',
  channel_id: 'ch',
  server_id: 's1',
  channel_name: 'Geral',
  server_name: 'Salinha'
}

describe('invitePlace', () => {
  it('servidor - canal', () => {
    expect(invitePlace(invite)).toBe('Salinha - Geral')
  })
  it('cai para o que houver', () => {
    expect(invitePlace({ ...invite, server_name: '' })).toBe('Geral')
    expect(invitePlace({ ...invite, channel_name: undefined })).toBe('Salinha')
    expect(invitePlace({ call_id: 'c1', channel_id: 'ch' })).toBe('Canal de voz')
  })
})

describe('cardView', () => {
  const base = { invite, authorName: 'Ana', isMine: false }

  it('call acabou: cartão de convite inválido, sem botão', () => {
    expect(cardView({ ...base, validity: 'invalid' })).toEqual({ kind: 'invalid' })
    expect(cardView({ ...base, isMine: true, validity: 'invalid' })).toEqual({ kind: 'invalid' })
  })

  it('convidado vê "Fulano convidou você" e o botão Abrir', () => {
    expect(cardView({ ...base, validity: 'valid' })).toEqual({
      kind: 'valid',
      title: 'Ana convidou você para a call',
      place: 'Salinha - Geral',
      button: 'open'
    })
  })

  it('enquanto confere a call, o botão espera', () => {
    expect(cardView({ ...base, validity: 'unknown' })).toMatchObject({ button: 'loading' })
  })

  it('quem convidou vê o cartão sem botão', () => {
    expect(cardView({ ...base, isMine: true, validity: 'valid' })).toMatchObject({
      title: 'Você convidou para a call',
      button: 'none'
    })
  })
})
