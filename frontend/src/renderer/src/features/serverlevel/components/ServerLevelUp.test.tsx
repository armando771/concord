import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../call/store/callStore', () => ({
  useCallStore: { getState: () => ({ status: 'idle' }) }
}))
// SSR lê o estado atual do zustand (mesmo truque do ServerLevel.test).
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) =>
  getSnapshot()
)

import { useServerStore } from '../../servers/store/serverStore'
import { useServerLevelUpStore } from '../store/serverLevelUpStore'
import ServerLevelUpOverlay from './ServerLevelUpOverlay'

const screen = (reduce: boolean): void => {
  vi.stubGlobal('window', {
    innerWidth: 390,
    innerHeight: 800,
    devicePixelRatio: 2,
    matchMedia: () => ({ matches: reduce })
  })
}

const render = (): string => renderToStaticMarkup(<ServerLevelUpOverlay />)

describe('animação de subida de nível do servidor', () => {
  beforeEach(() => {
    screen(false)
    useServerStore.setState({
      servers: [
        { id: 's1', name: 'Salinha', owner_id: 'u' },
        { id: 's2', name: 'Outro', owner_id: 'u', icon_url: '/uploads/i.png' }
      ]
    })
    useServerLevelUpStore.getState().close()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sem subida não mostra nada', () => {
    expect(render()).toBe('')
  })

  it('mostra ícone, contagem do anterior até o novo e o selo com o nome do servidor', () => {
    useServerLevelUpStore.getState().show({ serverId: 's1', level: 6, previous: 4 })
    const html = render()
    expect(html).toContain('<canvas')
    expect(html).toContain('data-server-scene="fogos"')
    expect(html).toContain('Salinha')
    expect(html).toContain('Nível 6 do servidor')
    expect(html).toContain('>4</span>')
    expect(html).toContain('>6</span>')
    // Não-modal: não recebe clique nem foco.
    expect(html).toContain('pointer-events-none')
    expect(html).not.toContain('tabindex')
    expect(html).toContain('>S</span>') // sem ícone: a inicial
  })

  it('nos marcos o selo leva o nome da cena, e o ícone do servidor aparece', () => {
    useServerLevelUpStore.getState().show({ serverId: 's2', level: 25, previous: 24 })
    const html = render()
    expect(html).toContain('data-server-scene="supernova"')
    expect(html).toContain('Nível 25 do servidor · Supernova')
    expect(html).toContain('<img')
  })

  it('com movimento reduzido: sem canvas e já no número final', () => {
    screen(true)
    useServerLevelUpStore.getState().show({ serverId: 's1', level: 12, previous: 3 })
    const html = render()
    expect(html).not.toContain('<canvas')
    expect(html).toContain('level-fade')
    expect(html).not.toContain('>3</span>')
    expect(html).toContain('>12</span>')
    expect(html).not.toContain('server-lvl-icon')
  })

  it('servidor que sumiu da lista ainda mostra a animação', () => {
    useServerLevelUpStore.getState().show({ serverId: 'x', level: 2, previous: 1 })
    expect(render()).toContain('Servidor')
  })
})
