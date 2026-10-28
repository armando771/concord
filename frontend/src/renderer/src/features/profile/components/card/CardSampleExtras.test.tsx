import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CardMemberSince, CardVisitorButtons } from './CardSampleExtras'

describe('CardMemberSince', () => {
  it('a data em que a conta foi criada', () => {
    const html = renderToStaticMarkup(<CardMemberSince createdAt="2026-10-25T12:00:00Z" />)
    expect(html).toContain('Membro desde')
    expect(html).toContain('2026')
    expect(html).toContain('no Salinha')
  })
  it('sem data (ou inválida): nada', () => {
    expect(renderToStaticMarkup(<CardMemberSince />)).toBe('')
    expect(renderToStaticMarkup(<CardMemberSince createdAt="ontem" />)).toBe('')
  })
})

describe('CardVisitorButtons', () => {
  it('só de enfeite: fora do Tab e do leitor de tela', () => {
    const html = renderToStaticMarkup(<CardVisitorButtons />)
    expect(html).toContain('Enviar mensagem')
    expect(html).toContain('inert')
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('<button')
  })
})
