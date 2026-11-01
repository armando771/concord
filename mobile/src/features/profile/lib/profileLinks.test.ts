import { detectProvider, linkError, linkLabel, normalizeLink, splitLinks } from './profileLinks'

describe('detectProvider', () => {
  it.each([
    ['https://steamcommunity.com/id/mugis', 'steam'],
    ['https://store.steampowered.com/app/730', 'steam'],
    ['https://www.twitch.tv/mugis_rx', 'twitch'],
    ['https://m.youtube.com/@mugis', 'youtube'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube'],
    ['https://x.com/mugis', 'x'],
    ['https://twitter.com/mugis', 'x'],
    ['https://www.instagram.com/mugis', 'instagram'],
    ['https://www.tiktok.com/@mugis', 'tiktok'],
    ['https://github.com/mugis', 'github'],
    ['https://open.spotify.com/user/mugis', 'spotify'],
    ['https://kick.com/mugis', 'kick'],
    ['https://old.reddit.com/u/mugis', 'reddit'],
    ['https://bsky.app/profile/mugis', 'bluesky']
  ])('%s → %s', (url, id) => {
    expect(detectProvider(url).id).toBe(id)
  })

  it('domínio desconhecido vira "site"', () => {
    expect(detectProvider('https://mugis.dev')).toEqual({ id: 'site', label: 'Site' })
  })

  it('não cai em domínio parecido', () => {
    expect(detectProvider('https://nottwitch.tv/x').id).toBe('site')
    expect(detectProvider('https://twitch.tv.golpe.com/x').id).toBe('site')
  })
})

describe('normalizeLink', () => {
  it('completa com https://', () => {
    expect(normalizeLink(' twitch.tv/mugis ')).toBe('https://twitch.tv/mugis')
  })

  it('mantém o esquema que veio', () => {
    expect(normalizeLink('http://site.com')).toBe('http://site.com')
    expect(normalizeLink('javascript:alert(1)')).toBe('javascript:alert(1)')
  })

  it('vazio continua vazio', () => {
    expect(normalizeLink('   ')).toBe('')
  })
})

describe('linkError', () => {
  it('aceita http(s) com domínio', () => {
    expect(linkError('https://steamcommunity.com/id/mugis')).toBeNull()
  })

  it.each(['javascript:alert(1)', 'ftp://x.com', 'data:text/html,oi', 'https://', ''])(
    'recusa %s',
    (url) => {
      expect(linkError(url)).not.toBeNull()
    }
  )

  it('recusa link grande demais', () => {
    expect(linkError(`https://a.com/${'a'.repeat(250)}`)).not.toBeNull()
  })
})

describe('linkLabel', () => {
  it('mostra domínio e caminho sem www e sem barra no fim', () => {
    expect(linkLabel('https://www.twitch.tv/mugis_rx/')).toBe('twitch.tv/mugis_rx')
  })
})

describe('splitLinks', () => {
  it('separa os links do texto', () => {
    expect(splitLinks('live em https://twitch.tv/mugis toda noite')).toEqual([
      { text: 'live em ' },
      { text: 'https://twitch.tv/mugis', url: 'https://twitch.tv/mugis' },
      { text: ' toda noite' }
    ])
  })

  it('pontuação no fim fica fora do link', () => {
    expect(splitLinks('veja https://site.com.')).toEqual([
      { text: 'veja ' },
      { text: 'https://site.com', url: 'https://site.com' },
      { text: '.' }
    ])
  })

  it('texto sem link e javascript: continuam texto', () => {
    expect(splitLinks('oi\ntudo bem')).toEqual([{ text: 'oi\ntudo bem' }])
    expect(splitLinks('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }])
  })
})
