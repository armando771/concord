import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServerHoverCardBody } from './ServerHoverCard'

const people = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i}`, name: `Pessoa ${i}`, avatarUrl: null }))

describe('ServerHoverCardBody', () => {
  it('sem ninguém em call mostra só o nome', () => {
    const html = renderToStaticMarkup(<ServerHoverCardBody name="Os Brothers" people={[]} />)
    expect(html).toContain('Os Brothers')
    expect(html).not.toContain('Em call')
    expect(html).not.toContain('<svg')
  })

  it('com gente em call mostra o ícone, os avatares e os nomes para leitor de tela', () => {
    const html = renderToStaticMarkup(<ServerHoverCardBody name="Os Brothers" people={people(2)} />)
    expect(html).toContain('<svg')
    expect(html).toContain('Em call: Pessoa 0, Pessoa 1')
    expect(html).toContain('>P<')
    expect(html).not.toContain('+')
  })

  it('passou de 5 pessoas: 5 avatares e o contador com o resto', () => {
    const html = renderToStaticMarkup(<ServerHoverCardBody name="Os Brothers" people={people(8)} />)
    expect(html.match(/>P</g)).toHaveLength(5)
    expect(html).toContain('+3')
  })
})
