import { describe, expect, it } from 'vitest'
import {
  ACTIVITIES,
  activityLaunchUrl,
  activityRoomFromUrl,
  findActivity,
  isAllowedActivityUrl,
  validateActivityLink
} from './activities'

describe('catálogo de atividades', () => {
  it('só o Krunker.io', () => {
    expect(ACTIVITIES.map((a) => a.id)).toEqual(['krunker'])
    // Cada jogo tem a própria sessão na janela do desktop.
    expect(new Set(ACTIVITIES.map((a) => a.partition)).size).toBe(ACTIVITIES.length)
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

describe('validateActivityLink com código da sala', () => {
  it('Krunker: REGIÃO:id vira o link da sala', () => {
    expect(validateActivityLink('krunker', ' BRZ:tukbo ')).toEqual({
      ok: true,
      url: 'https://krunker.io/?game=BRZ:tukbo'
    })
  })

  it('código com cara errada continua recusado', () => {
    expect(validateActivityLink('krunker', 'sala do joão').ok).toBe(false)
    expect(validateActivityLink('krunker', 'r7S5').ok).toBe(false)
  })
})

describe('activityRoomFromUrl', () => {
  it('Krunker: a URL da partida (?game=REGIÃO:id) é a sala', () => {
    expect(activityRoomFromUrl('krunker', 'https://krunker.io/?game=BRZ:tukbo')).toBe(
      'https://krunker.io/?game=BRZ:tukbo'
    )
  })

  it('só os parâmetros da sala vão adiante (o resto da URL é descartado)', () => {
    expect(
      activityRoomFromUrl('krunker', 'https://krunker.io/?game=BRZ:tukbo&utm_source=x&token=abc')
    ).toBe('https://krunker.io/?game=BRZ:tukbo')
  })

  it.each([
    ['página inicial', 'krunker', 'https://krunker.io/'],
    ['hash sem sala', 'krunker', 'https://krunker.io/#1Fu4'],
    ['outra página do site', 'krunker', 'https://krunker.io/social.html?game=BRZ:tukbo'],
    ['outro site', 'krunker', 'https://evil.com/?game=BRZ:tukbo'],
    ['código esquisito', 'krunker', 'https://krunker.io/?game=<script>'],
    ['sala em outro site', 'krunker', 'https://example.com/?game=BRZ:tukbo'],
    ['atividade desconhecida', 'doom', 'https://krunker.io/?game=BRZ:tukbo'],
    ['lixo', 'krunker', 'não é url']
  ])('%s: null', (_name, id, url) => {
    expect(activityRoomFromUrl(id, url)).toBeNull()
  })

  it('a sala capturada passa na validação do link (e cabe no limite)', () => {
    const room = activityRoomFromUrl('krunker', 'https://krunker.io/?game=BRZ:tukbo')
    expect(room).not.toBeNull()
    expect(isAllowedActivityUrl('krunker', room ?? '')).toBe(true)
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
