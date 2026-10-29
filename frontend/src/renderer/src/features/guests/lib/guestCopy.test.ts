import { describe, expect, it } from 'vitest'
import { endedTexts, GUEST_COPY, joinButtonLabel } from './guestCopy'

describe('textos do visitante', () => {
  it('botão de entrar', () => {
    expect(joinButtonLabel(true)).toBe('Entrando...')
    expect(joinButtonLabel(false)).toBe('Entrar na call')
  })

  it('tela final: saiu ou o acesso acabou', () => {
    expect(endedTexts('left').title).toBe('Você saiu da call')
    expect(endedTexts('expired')).toEqual({
      title: 'Seu acesso terminou',
      body: 'O tempo de acesso de visitante acabou.'
    })
    expect(endedTexts('???').body).toBe('Seu acesso de visitante foi encerrado.')
  })

  it('o que o visitante pode, conforme o convite', () => {
    expect(GUEST_COPY.landingPerms(true, true)).toMatch(/falar, ligar a câmera e transmitir/)
    expect(GUEST_COPY.landingPerms(true, false)).toMatch(/Câmera e tela ficam desligadas/)
    expect(GUEST_COPY.landingPerms(false, true)).toMatch(/mas não falar/)
    expect(GUEST_COPY.landingPerms(false, false)).toMatch(/ouvir e assistir/)
  })
})
