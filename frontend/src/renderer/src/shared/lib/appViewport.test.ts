import { describe, expect, it } from 'vitest'
import { appViewportHeight } from './appViewport'

describe('appViewportHeight', () => {
  it('sem teclado (viewport visual = janela) não força nada: vale o 100dvh', () => {
    expect(appViewportHeight({ visualHeight: 740, scale: 1, innerHeight: 740 })).toBeNull()
  })

  it('com o teclado aberto, a casca encolhe para a área visível', () => {
    expect(appViewportHeight({ visualHeight: 412.6, scale: 1, innerHeight: 740 })).toBe(413)
  })

  it('com zoom de pinça não mexe (a área visível encolhe sem teclado)', () => {
    expect(appViewportHeight({ visualHeight: 370, scale: 2, innerHeight: 740 })).toBeNull()
  })

  it('diferença pequena (barra do navegador) não conta como teclado', () => {
    expect(appViewportHeight({ visualHeight: 700, scale: 1, innerHeight: 740 })).toBeNull()
  })
})
