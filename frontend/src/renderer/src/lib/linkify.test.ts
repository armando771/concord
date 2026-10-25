import { describe, expect, it } from 'vitest'
import { linkify, messageParts, type LinkPart } from './linkify'

/** Só os links: [texto, href]. */
const links = (text: string): Array<[string, string]> =>
  linkify(text)
    .filter((p): p is LinkPart & { href: string } => Boolean(p.href))
    .map((p) => [p.text, p.href])

const joined = (text: string): string =>
  linkify(text)
    .map((p) => p.text)
    .join('')

describe('linkify', () => {
  it('acha http(s):// e www.', () => {
    expect(links('veja https://exemplo.com/a?b=1&c=2#x e http://x.org')).toEqual([
      ['https://exemplo.com/a?b=1&c=2#x', 'https://exemplo.com/a?b=1&c=2#x'],
      ['http://x.org', 'http://x.org']
    ])
    expect(links('entra em www.salinha.app/convite')).toEqual([
      ['www.salinha.app/convite', 'https://www.salinha.app/convite']
    ])
  })

  it('não perde nem duplica texto', () => {
    const text = 'a https://x.com/b. c (www.y.com) d'
    expect(joined(text)).toBe(text)
  })

  it('pontuação no fim fica de fora', () => {
    expect(links('olha https://x.com/a.')).toEqual([['https://x.com/a', 'https://x.com/a']])
    expect(links('https://x.com, depois')).toEqual([['https://x.com', 'https://x.com']])
    expect(links('viu https://x.com?!')).toEqual([['https://x.com', 'https://x.com']])
    expect(links('é https://x.com/a...')).toEqual([['https://x.com/a', 'https://x.com/a']])
    expect(links('www.x.com:')).toEqual([['www.x.com', 'https://www.x.com']])
  })

  it('parêntese no fim só entra se estiver balanceado no link', () => {
    expect(links('https://pt.wikipedia.org/wiki/Rio_(cidade)')).toEqual([
      ['https://pt.wikipedia.org/wiki/Rio_(cidade)', 'https://pt.wikipedia.org/wiki/Rio_(cidade)']
    ])
    expect(links('(veja https://x.com/a)')).toEqual([['https://x.com/a', 'https://x.com/a']])
    expect(links('(https://x.com/f(x)).')).toEqual([['https://x.com/f(x)', 'https://x.com/f(x)']])
    expect(links('https://x.com/a),')).toEqual([['https://x.com/a', 'https://x.com/a']])
  })

  it('para em espaço, aspas e < >', () => {
    expect(links('<https://x.com/a>')).toEqual([['https://x.com/a', 'https://x.com/a']])
    expect(links('"https://x.com/a"')).toEqual([['https://x.com/a', 'https://x.com/a']])
    expect(links('https://x.com/a\nhttps://y.com')).toEqual([
      ['https://x.com/a', 'https://x.com/a'],
      ['https://y.com', 'https://y.com']
    ])
  })

  it('aceita acentos no caminho e maiúsculas no esquema', () => {
    expect(links('https://exemplo.com.br/página')).toEqual([
      ['https://exemplo.com.br/página', 'https://exemplo.com.br/página']
    ])
    expect(links('HTTPS://X.COM')).toEqual([['HTTPS://X.COM', 'HTTPS://X.COM']])
  })

  it('nunca gera javascript: ou data:', () => {
    expect(links('javascript:alert(1)')).toEqual([])
    expect(links('javascript://https://x.com/%0aalert(1)')).toEqual([])
    expect(links('data:text/html;base64,PHNjcmlwdD4=')).toEqual([])
    expect(links('JaVaScRiPt:alert(1)')).toEqual([])
  })

  it('só no começo de palavra: nada de e-mail, @nick ou pedaço de outro link', () => {
    expect(links('fale com ana@www.exemplo.com')).toEqual([])
    expect(links('@www.exemplo.com')).toEqual([])
    expect(links('foo.www.exemplo.com')).toEqual([])
    expect(links('xhttps://x.com')).toEqual([])
  })

  it('link com usuário (good.com@evil.com) não vira link: o texto enganaria', () => {
    expect(links('http://good.com@evil.com/x')).toEqual([])
    expect(links('https://user:senha@exemplo.com')).toEqual([])
    // "@" no caminho é normal (medium.com/@ana).
    expect(links('https://medium.com/@ana')).toEqual([
      ['https://medium.com/@ana', 'https://medium.com/@ana']
    ])
  })

  it('controle de direção do texto (bidi) encerra o link', () => {
    expect(links('https://x.com/a\u202Ebad')).toEqual([['https://x.com/a', 'https://x.com/a']])
    expect(links('https://x.com/a\u2066b')).toEqual([['https://x.com/a', 'https://x.com/a']])
  })

  it('sem host não é link', () => {
    expect(links('https://')).toEqual([])
    expect(links('https:// x')).toEqual([])
    expect(links('www.')).toEqual([])
    expect(links('http://.')).toEqual([])
  })

  it('texto sem link volta inteiro', () => {
    expect(linkify('oi, tudo bem?')).toEqual([{ text: 'oi, tudo bem?' }])
    expect(linkify('')).toEqual([{ text: '' }])
  })
})

describe('messageParts (links + menções)', () => {
  it('menção e link juntos', () => {
    expect(messageParts('@ana veja https://x.com/@bia', null)).toEqual([
      { text: '@ana', mention: 'ana' },
      { text: ' veja ' },
      { text: 'https://x.com/@bia', href: 'https://x.com/@bia' }
    ])
  })

  it('@all liberado continua chip, com link depois', () => {
    expect(messageParts('@all https://x.com', 'all')).toEqual([
      { text: '@all', mention: 'all' },
      { text: ' ' },
      { text: 'https://x.com', href: 'https://x.com' }
    ])
    expect(messageParts('@all https://x.com', null)).toEqual([
      { text: '@all ' },
      { text: 'https://x.com', href: 'https://x.com' }
    ])
  })

  it('nada de link dentro do chip de menção', () => {
    expect(messageParts('oi @www.exemplo.com', null)).toEqual([
      { text: 'oi ' },
      { text: '@www.exemplo.com', mention: 'www.exemplo.com' }
    ])
  })

  it('@ dentro do link não vira chip', () => {
    expect(messageParts('https://x.com/(@ana)', null)).toEqual([
      { text: 'https://x.com/(@ana)', href: 'https://x.com/(@ana)' }
    ])
  })

  it('sem link é igual ao splitMentions', () => {
    expect(messageParts('oi @ana, tudo?', null)).toEqual([
      { text: 'oi ' },
      { text: '@ana', mention: 'ana' },
      { text: ', tudo?' }
    ])
  })
})

describe('linkify: tempo linear (mensagem maliciosa não trava o app)', () => {
  // Payloads da revisão: muitos começos de link rejeitados no mesmo token e
  // muitos ")" no fim. A versão antiga levava 35 s com 4000 caracteres.
  const WORST: Record<string, string> = {
    'https://.( × 200 + ) × 2000': 'https://.('.repeat(200) + ')'.repeat(2000),
    'https://.( × 100 + ) × 1000': 'https://.('.repeat(100) + ')'.repeat(1000),
    'https:// colado × 500': 'https://'.repeat(500),
    'www. colado × 1000': 'www.'.repeat(1000),
    'link + ) × 3986': 'https://a.com/' + ')'.repeat(3986),
    'link + ( × 3986': 'https://a.com/' + '('.repeat(3986),
    '(https://a.co/ × 285': '(https://a.co/'.repeat(285),
    'links válidos × 266': 'https://a.co/x '.repeat(266),
    'www.a.( × 570': 'www.a.('.repeat(570),
    '@x.https:// × 363': '@x.https://'.repeat(363)
  }

  for (const [name, payload] of Object.entries(WORST)) {
    it(`${name} (${payload.length} caracteres) em menos de 20 ms`, () => {
      expect(payload.length).toBeLessThanOrEqual(4000)
      messageParts(payload, null) // aquece o JIT
      const start = performance.now()
      const parts = messageParts(payload, null)
      const elapsed = performance.now() - start
      expect(parts.map((p) => p.text).join('')).toBe(payload)
      expect(elapsed).toBeLessThan(20)
    })
  }

  it('no máximo 50 links por mensagem; o resto fica texto', () => {
    const text = 'https://a.co/x '.repeat(80)
    const parts = linkify(text)
    expect(parts.filter((p) => p.href)).toHaveLength(50)
    expect(parts.map((p) => p.text).join('')).toBe(text)
  })

  it('link com mais de 2048 caracteres fica texto', () => {
    const long = 'https://a.com/' + 'x'.repeat(2100)
    expect(links(`veja ${long} ok`)).toEqual([])
    const ok = 'https://a.com/' + 'x'.repeat(2000)
    expect(links(ok)).toEqual([[ok, ok]])
  })
})
