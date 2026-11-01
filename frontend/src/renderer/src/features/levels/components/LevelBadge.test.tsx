import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../api/levels', () => ({ fetchLevels: () => new Promise(() => {}) }))
// SSR lê o estado atual do zustand (mesmo truque do ServerLevel.test).
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) =>
  getSnapshot()
)

import { useLevelStore } from '../store/levelStore'
import LevelBadge from './LevelBadge'

const withLevel = (level: number, previous?: number): void => {
  useLevelStore.setState({
    levels: { u1: level },
    celebrations: previous === undefined ? {} : { u1: { level, previous, key: 1 } }
  })
}

const render = (onClick?: () => void): string =>
  renderToStaticMarkup(<LevelBadge userId="u1" onClick={onClick} />)

describe('LevelBadge', () => {
  beforeEach(() => useLevelStore.setState({ levels: {}, celebrations: {} }))

  it('sem nível carregado não mostra nada', () => {
    expect(render()).toBe('')
  })

  it.each([
    [13, 'estrelas'],
    [14, 'onca'],
    [22, 'brasil'],
    [24, 'orgulho'],
    [23, 'faixa'],
    [120, 'lendario']
  ])('nível %i usa o selo "%s"', (level, variant) => {
    withLevel(level)
    const html = render()
    expect(html).toContain(`data-badge="${variant}"`)
    expect(html).toContain(`>${level}</span>`)
  })

  it('subindo, o número antigo sai e o novo entra (com brilho)', () => {
    withLevel(13, 12)
    const html = render()
    expect(html).toContain('level-num-old')
    expect(html).toContain('0 0 14px')
  })

  it('do 20 em diante o número rola como contador', () => {
    withLevel(24, 23)
    const html = render()
    expect(html).toContain('level-roll')
    expect(html).toContain('>18</span>')
  })

  it('com onClick vira um botão que toca a animação', () => {
    withLevel(14)
    const html = render(() => {})
    expect(html).toContain('role="button"')
    expect(html).toContain('Tocar a animação do nível 14')
  })
})
