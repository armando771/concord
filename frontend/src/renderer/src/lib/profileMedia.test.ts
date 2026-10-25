import { describe, expect, it } from 'vitest'
import { isAnimatedMedia, profileMediaSrc } from './profileMedia'

const BASE = 'http://localhost:8080/api'
const ID = '6f1c1f43-6f4e-4a3c-9a52-2f8d8c1f0c11'

describe('isAnimatedMedia', () => {
  it('reconhece o prefixo a_ do GIF', () => {
    expect(isAnimatedMedia(`/api/profile-media/a_${ID}`)).toBe(true)
    expect(isAnimatedMedia(`/api/profile-media/${ID}`)).toBe(false)
  })

  it('sem foto ou prévia local não anima pelo servidor', () => {
    expect(isAnimatedMedia(null)).toBe(false)
    expect(isAnimatedMedia(undefined)).toBe(false)
    expect(isAnimatedMedia('blob:http://x/a_123')).toBe(false)
  })
})

describe('profileMediaSrc', () => {
  it('resolve a URL salva com o endereço do servidor', () => {
    expect(profileMediaSrc(`/api/profile-media/${ID}`, BASE)).toBe(
      `http://localhost:8080/api/profile-media/${ID}`
    )
  })

  it('pede o quadro parado só quando a imagem anima', () => {
    expect(profileMediaSrc(`/api/profile-media/a_${ID}`, BASE, { animate: false })).toBe(
      `http://localhost:8080/api/profile-media/a_${ID}/static`
    )
    expect(profileMediaSrc(`/api/profile-media/${ID}`, BASE, { animate: false })).toBe(
      `http://localhost:8080/api/profile-media/${ID}`
    )
    expect(profileMediaSrc(`/api/profile-media/a_${ID}`, BASE, { animate: true })).toBe(
      `http://localhost:8080/api/profile-media/a_${ID}`
    )
  })

  it('no navegador (base relativa) fica na mesma origem', () => {
    expect(profileMediaSrc(`/api/profile-media/a_${ID}`, '/api', { animate: false })).toBe(
      `/api/profile-media/a_${ID}/static`
    )
  })

  it('prévia local e URL completa voltam como estão', () => {
    expect(profileMediaSrc('blob:http://localhost/abc', BASE, { animate: false })).toBe(
      'blob:http://localhost/abc'
    )
    expect(profileMediaSrc('https://cdn.site/x.png', BASE)).toBe('https://cdn.site/x.png')
  })

  it('sem foto devolve null', () => {
    expect(profileMediaSrc(null, BASE)).toBeNull()
    expect(profileMediaSrc('', BASE)).toBeNull()
  })
})
