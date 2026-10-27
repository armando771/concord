import { describe, expect, it } from 'vitest'
import { isSwipeToList } from './swipe'

const base = { startX: 120, width: 360, dx: 120, dy: 10, ms: 250 }

describe('isSwipeToList', () => {
  it('arrastar o dedo para a direita no chat volta para a lista', () => {
    expect(isSwipeToList(base)).toBe(true)
  })

  it('arrasto curto não conta (era um toque ou começo de rolagem)', () => {
    expect(isSwipeToList({ ...base, dx: 40 })).toBe(false)
  })

  it('para a esquerda não volta', () => {
    expect(isSwipeToList({ ...base, dx: -120 })).toBe(false)
  })

  it('rolando a lista na vertical (diagonal) não volta', () => {
    expect(isSwipeToList({ ...base, dx: 90, dy: 60 })).toBe(false)
  })

  it('a partir da beirada da tela é o "voltar" do sistema: não mexe', () => {
    expect(isSwipeToList({ ...base, startX: 8 })).toBe(false)
  })

  it('arrasto lento demais (segurou e arrastou) não conta', () => {
    expect(isSwipeToList({ ...base, ms: 1200 })).toBe(false)
  })
})
