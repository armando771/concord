import { afterEach, describe, expect, it, vi } from 'vitest'
import { reachedTop, topWatchTargets } from './infiniteScroll'

describe('reachedTop', () => {
  it('o topo da lista chegou perto da área visível', () => {
    expect(reachedTop([{ isIntersecting: false }, { isIntersecting: true }])).toBe(true)
  })

  it('ainda longe do topo', () => {
    expect(reachedTop([{ isIntersecting: false }])).toBe(false)
    expect(reachedTop([])).toBe(false)
  })
})

describe('topWatchTargets', () => {
  const root = { id: 'scroller' }
  const target = { id: 'sentinela' }

  afterEach(() => vi.unstubAllGlobals())

  it('observa o topo quando há páginas antigas e a lista já está desenhada', () => {
    vi.stubGlobal('IntersectionObserver', class {})
    expect(topWatchTargets(true, root, target)).toEqual({ root, target })
  })

  it('sem páginas antigas (ou carregando a sala): não observa', () => {
    vi.stubGlobal('IntersectionObserver', class {})
    expect(topWatchTargets(false, root, target)).toBeNull()
  })

  it('sem o scroller ou o sentinela na tela: não observa', () => {
    vi.stubGlobal('IntersectionObserver', class {})
    expect(topWatchTargets(true, null, target)).toBeNull()
    expect(topWatchTargets(true, root, null)).toBeNull()
  })

  it('sem IntersectionObserver no ambiente: não observa', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    expect(topWatchTargets(true, root, target)).toBeNull()
  })
})
