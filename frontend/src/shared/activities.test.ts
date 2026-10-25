import { describe, expect, it } from 'vitest'
import {
  ACTIVITIES,
  activityLaunchUrl,
  findActivity,
  isAllowedActivityUrl,
  validateActivityLink
} from './activities'

describe('catálogo de atividades', () => {
  it('começa só com o Krunker.io', () => {
    expect(ACTIVITIES.map((a) => a.id)).toEqual(['krunker'])
    const krunker = findActivity('krunker')
    expect(krunker?.name).toBe('Krunker.io')
    expect(krunker?.origins).toEqual(['https://krunker.io'])
    expect(krunker?.homeUrl).toBe('https://krunker.io/')
  })

  it('id desconhecido não acha nada', () => {
    expect(findActivity('doom')).toBeUndefined()
    expect(findActivity('')).toBeUndefined()
  })
})

describe('validateActivityLink', () => {
  it('vazio é aceito (sem link: abre a página do jogo)', () => {
    expect(validateActivityLink('krunker', '')).toEqual({ ok: true, url: '' })
    expect(validateActivityLink('krunker', '   ')).toEqual({ ok: true, url: '' })
  })

  it('aceita o link da sala do Krunker', () => {
    expect(validateActivityLink('krunker', ' https://krunker.io/?game=FRA:abc12 ')).toEqual({
      ok: true,
      url: 'https://krunker.io/?game=FRA:abc12'
    })
    expect(validateActivityLink('krunker', 'https://krunker.io')).toEqual({
      ok: true,
      url: 'https://krunker.io'
    })
  })

  it.each([
    ['http', 'http://krunker.io/?game=FRA:abc12'],
    ['outro domínio', 'https://evil.com/?game=FRA:abc12'],
    ['subdomínio', 'https://www.krunker.io/'],
    ['sufixo enganoso', 'https://krunker.io.evil.com/'],
    ['usuário apontando para fora', 'https://krunker.io@evil.com/'],
    ['credenciais', 'https://user:pass@krunker.io/'],
    ['porta', 'https://krunker.io:8443/'],
    ['javascript', 'javascript:alert(1)'],
    ['sem esquema', 'krunker.io/?game=FRA:abc12'],
    ['esquema sem barras', 'https:krunker.io/'],
    ['texto qualquer', 'sala do joão'],
    ['longo demais', 'https://krunker.io/?game=' + 'a'.repeat(600)]
  ])('recusa %s', (_name, link) => {
    expect(validateActivityLink('krunker', link)).toEqual({
      ok: false,
      error: 'Use um link https://krunker.io/…'
    })
  })

  it('atividade desconhecida', () => {
    expect(validateActivityLink('doom', 'https://krunker.io/')).toEqual({
      ok: false,
      error: 'Atividade desconhecida.'
    })
  })
})

describe('isAllowedActivityUrl', () => {
  it('só origens do catálogo (usado pelo main antes de abrir a janela)', () => {
    expect(isAllowedActivityUrl('krunker', 'https://krunker.io/')).toBe(true)
    expect(isAllowedActivityUrl('krunker', 'https://krunker.io/?game=FRA:abc12')).toBe(true)
    expect(isAllowedActivityUrl('krunker', '')).toBe(false)
    expect(isAllowedActivityUrl('krunker', 'https://evil.com/')).toBe(false)
    expect(isAllowedActivityUrl('doom', 'https://krunker.io/')).toBe(false)
  })
})

describe('activityLaunchUrl', () => {
  it('com link abre a sala; sem link, a página do jogo', () => {
    expect(activityLaunchUrl('krunker', 'https://krunker.io/?game=FRA:abc12')).toBe(
      'https://krunker.io/?game=FRA:abc12'
    )
    expect(activityLaunchUrl('krunker', '')).toBe('https://krunker.io/')
  })

  it('link que não passa na validação cai na página do jogo', () => {
    expect(activityLaunchUrl('krunker', 'https://evil.com/')).toBe('https://krunker.io/')
  })

  it('atividade desconhecida: null', () => {
    expect(activityLaunchUrl('doom', '')).toBeNull()
  })
})
