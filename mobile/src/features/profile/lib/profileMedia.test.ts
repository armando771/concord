import { isAnimatedMedia, profileMediaSrc } from './profileMedia'

const ID = '6f1c1f43-6f4e-4a3c-9a52-2f8d8c1f0c11'
const ORIGIN = 'http://localhost:8080'

describe('isAnimatedMedia', () => {
  it('reconhece o prefixo a_ do GIF', () => {
    expect(isAnimatedMedia(`/api/profile-media/a_${ID}`)).toBe(true)
    expect(isAnimatedMedia(`/api/profile-media/${ID}`)).toBe(false)
  })

  it('sem foto ou prévia local não anima pelo servidor', () => {
    expect(isAnimatedMedia(null)).toBe(false)
    expect(isAnimatedMedia(undefined)).toBe(false)
    expect(isAnimatedMedia('blob:http://x/a_123')).toBe(false)
    expect(isAnimatedMedia('file:///cache/a_123.gif')).toBe(false)
  })
})

describe('profileMediaSrc', () => {
  it('resolve a URL salva com o endereço do servidor', () => {
    expect(profileMediaSrc(`/api/profile-media/${ID}`)).toBe(`${ORIGIN}/api/profile-media/${ID}`)
  })

  it('GIF anima por padrão e pede o quadro parado com animate: false', () => {
    expect(profileMediaSrc(`/api/profile-media/a_${ID}`)).toBe(`${ORIGIN}/api/profile-media/a_${ID}`)
    expect(profileMediaSrc(`/api/profile-media/a_${ID}`, { animate: true })).toBe(
      `${ORIGIN}/api/profile-media/a_${ID}`
    )
    expect(profileMediaSrc(`/api/profile-media/a_${ID}`, { animate: false })).toBe(
      `${ORIGIN}/api/profile-media/a_${ID}/static`
    )
  })

  it('imagem que não anima fica igual nos dois modos', () => {
    expect(profileMediaSrc(`/api/profile-media/${ID}`, { animate: false })).toBe(`${ORIGIN}/api/profile-media/${ID}`)
  })

  it('prévia local e URL completa voltam como estão', () => {
    expect(profileMediaSrc('file:///cache/foto.png', { animate: false })).toBe('file:///cache/foto.png')
    expect(profileMediaSrc('blob:http://localhost/abc', { animate: false })).toBe('blob:http://localhost/abc')
    expect(profileMediaSrc('https://cdn.site/x.png')).toBe('https://cdn.site/x.png')
  })

  it('sem foto devolve null', () => {
    expect(profileMediaSrc(null)).toBeNull()
    expect(profileMediaSrc(undefined)).toBeNull()
    expect(profileMediaSrc('')).toBeNull()
  })
})
