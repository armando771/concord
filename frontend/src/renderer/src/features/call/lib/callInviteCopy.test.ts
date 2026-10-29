import { describe, expect, it } from 'vitest'
import { INVITE_COPY, resultText } from './callInviteCopy'

describe('textos do cartão', () => {
  it('título muda para quem foi convidado e para quem convidou', () => {
    expect(INVITE_COPY.cardTitleForGuest('Ana')).toBe('Ana convidou você para a call')
    expect(INVITE_COPY.cardTitleForAuthor).toBe('Você convidou para a call')
  })
})

describe('resultText', () => {
  it('conhece os status e tem fallback', () => {
    expect(resultText('busy')).toBe('Está em outra call')
    expect(resultText('failed')).toBe('Não foi possível enviar o convite')
    expect(resultText('x')).toBe('Não foi possível convidar')
  })

  it('offline e cooldown deixaram de existir (a DM guarda o convite)', () => {
    expect(resultText('offline')).toBe('Não foi possível convidar')
    expect(resultText('cooldown')).toBe('Não foi possível convidar')
  })
})
