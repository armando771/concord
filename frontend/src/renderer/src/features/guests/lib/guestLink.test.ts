import { describe, expect, it } from 'vitest'
import { guestLink, guestTokenFromClick, guestTokenFromUrl, validGuestToken } from './guestLink'

const TOKEN = 'aZ0_-'.repeat(9).slice(0, 43)

describe('link de visitante', () => {
  it('monta o link no app web', () => {
    expect(guestLink(TOKEN)).toBe(`https://app-salinha.bhrx.com.br/visitante/${TOKEN}`)
    expect(guestLink(TOKEN, 'http://localhost:5173')).toBe(
      `http://localhost:5173/visitante/${TOKEN}`
    )
  })

  it('aceita só o formato do token', () => {
    expect(validGuestToken(TOKEN)).toBe(true)
    expect(validGuestToken(TOKEN.slice(1))).toBe(false)
    expect(validGuestToken(`${TOKEN.slice(1)}/`)).toBe(false)
    expect(validGuestToken(undefined)).toBe(false)
  })

  it('reconhece o link nosso clicado no app', () => {
    expect(guestTokenFromUrl(`https://app-salinha.bhrx.com.br/visitante/${TOKEN}`, [])).toBe(TOKEN)
    expect(
      guestTokenFromUrl(`http://localhost:5173/visitante/${TOKEN}/`, ['http://localhost:5173'])
    ).toBe(TOKEN)
  })

  it('ignora outros hosts, outros caminhos e lixo', () => {
    expect(guestTokenFromUrl(`https://exemplo.com/visitante/${TOKEN}`, [])).toBeNull()
    expect(guestTokenFromUrl(`https://app-salinha.bhrx.com.br/convite/${TOKEN}`, [])).toBeNull()
    expect(
      guestTokenFromUrl(`https://a:b@app-salinha.bhrx.com.br/visitante/${TOKEN}`, [])
    ).toBeNull()
    expect(guestTokenFromUrl('não é url', [])).toBeNull()
  })
})

describe('clique no link de visitante dentro do app', () => {
  const href = `https://app-salinha.bhrx.com.br/visitante/${TOKEN}`
  const click = {
    href,
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false
  }

  it('clique simples abre a tela do visitante', () => {
    expect(guestTokenFromClick(click, [])).toBe(TOKEN)
  })

  it('com tecla, botão do meio, já tratado ou sem link segue o normal', () => {
    expect(guestTokenFromClick({ ...click, ctrlKey: true }, [])).toBeNull()
    expect(guestTokenFromClick({ ...click, button: 1 }, [])).toBeNull()
    expect(guestTokenFromClick({ ...click, defaultPrevented: true }, [])).toBeNull()
    expect(guestTokenFromClick({ ...click, href: null }, [])).toBeNull()
  })
})
