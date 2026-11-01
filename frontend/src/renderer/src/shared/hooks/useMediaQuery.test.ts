import { afterEach, describe, expect, it, vi } from 'vitest'
import { mediaQuerySource } from './useMediaQuery'

function stubMatchMedia(matches: boolean): { fire: (m: boolean) => void } {
  let listener: (() => void) | null = null
  const mql = {
    matches,
    addEventListener: (_: string, l: () => void) => (listener = l),
    removeEventListener: () => (listener = null)
  }
  vi.stubGlobal('window', { matchMedia: () => mql })
  return {
    fire: (m) => {
      mql.matches = m
      listener?.()
    }
  }
}

describe('mediaQuerySource', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lê se a consulta casa agora', () => {
    stubMatchMedia(true)
    expect(mediaQuerySource('(min-width: 768px)').getSnapshot()).toBe(true)
  })

  it('avisa quando a tela muda e para de avisar ao sair', () => {
    const media = stubMatchMedia(false)
    const source = mediaQuerySource('(min-width: 768px)')
    const onChange = vi.fn()
    const unsubscribe = source.subscribe(onChange)
    media.fire(true)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(source.getSnapshot()).toBe(true)
    unsubscribe()
    media.fire(false)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('sem window (node): vale o padrão', () => {
    expect(mediaQuerySource('(min-width: 768px)', true).getSnapshot()).toBe(true)
  })

  it('sem matchMedia (teste, SSR): vale o padrão', () => {
    vi.stubGlobal('window', {})
    const source = mediaQuerySource('(min-width: 768px)', true)
    expect(source.getSnapshot()).toBe(true)
    expect(() => source.subscribe(() => {})()).not.toThrow()
  })
})
