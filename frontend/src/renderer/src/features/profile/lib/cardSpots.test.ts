import { describe, expect, it } from 'vitest'
import { SPOT_LABEL, SPOT_PLACEHOLDER, spotOpensFile } from './cardSpots'

describe('partes editáveis do cartão', () => {
  it('avatar e banner abrem o arquivo; o resto, o modal', () => {
    expect(spotOpensFile('avatar')).toBe(true)
    expect(spotOpensFile('banner')).toBe(true)
    expect(spotOpensFile('name')).toBe(false)
    expect(spotOpensFile('bio')).toBe(false)
  })
  it('toda parte tem rótulo acessível', () => {
    for (const label of Object.values(SPOT_LABEL)) expect(label).toMatch(/^(Editar|Alterar) /)
  })
  it('as partes que podem ficar vazias têm convite', () => {
    expect(Object.keys(SPOT_PLACEHOLDER).sort()).toEqual(['bio', 'links', 'pronouns'])
  })
})
