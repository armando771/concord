import { gridColumns, phaseLabel } from './callLayout'

describe('gridColumns', () => {
  it('2 colunas em celular, 3 em tablet pequeno e 4 em tela larga', () => {
    expect(gridColumns(360, 8)).toBe(2)
    expect(gridColumns(768, 8)).toBe(3)
    expect(gridColumns(1280, 8)).toBe(4)
  })

  it('poucas pessoas não deixam colunas vazias', () => {
    expect(gridColumns(1280, 1)).toBe(1)
    expect(gridColumns(1280, 2)).toBe(2)
    expect(gridColumns(768, 0)).toBe(1)
  })
})

describe('phaseLabel', () => {
  it('textos aprovados de cada fase', () => {
    expect(phaseLabel('outgoing')).toBe('Chamando…')
    expect(phaseLabel('connecting')).toBe('Conectando…')
    expect(phaseLabel('reconnecting')).toBe('Reconectando…')
    expect(phaseLabel('active')).toBe('')
    expect(phaseLabel('idle')).toBe('')
  })
})
