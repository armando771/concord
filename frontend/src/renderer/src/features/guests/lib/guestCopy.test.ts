import { describe, expect, it } from 'vitest'
import { GUEST_COPY, joinButtonLabel } from './guestCopy'

describe('textos do visitante', () => {
  it('botão de entrar', () => {
    expect(joinButtonLabel(true, 'Ana')).toBe('Entrando...')
    expect(joinButtonLabel(false, 'Ana')).toBe('Entrar como Ana')
    expect(joinButtonLabel(false, null)).toBe('Entrar na call')
  })

  it('o que o visitante pode, conforme o convite', () => {
    expect(GUEST_COPY.landingPerms(true, true)).toMatch(/falar, ligar a câmera e transmitir/)
    expect(GUEST_COPY.landingPerms(true, false)).toMatch(/Câmera e tela ficam desligadas/)
    expect(GUEST_COPY.landingPerms(false, true)).toMatch(/mas não falar/)
    expect(GUEST_COPY.landingPerms(false, false)).toMatch(/ouvir e assistir/)
  })
})
