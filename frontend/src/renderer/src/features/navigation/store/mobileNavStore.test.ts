import { beforeEach, describe, expect, it } from 'vitest'
import { pathFromLocation, useMobileNavStore } from './mobileNavStore'

describe('pathFromLocation', () => {
  it('no navegador é o caminho', () => {
    expect(pathFromLocation({ pathname: '/dm/u1', hash: '' })).toBe('/dm/u1')
  })

  it('no desktop (rotas com hash) é o que vem depois do #', () => {
    expect(pathFromLocation({ pathname: '/index.html', hash: '#/servers/s1' })).toBe('/servers/s1')
  })
})

describe('useMobileNavStore', () => {
  beforeEach(() => useMobileNavStore.setState({ panel: 'nav', membersOpen: false }))

  it('alterna entre a lista e o conteúdo', () => {
    useMobileNavStore.getState().showContent()
    expect(useMobileNavStore.getState().panel).toBe('content')
    useMobileNavStore.getState().showNav()
    expect(useMobileNavStore.getState().panel).toBe('nav')
  })

  it('a gaveta de membros abre e fecha', () => {
    useMobileNavStore.getState().setMembersOpen(true)
    expect(useMobileNavStore.getState().membersOpen).toBe(true)
    useMobileNavStore.getState().setMembersOpen(false)
    expect(useMobileNavStore.getState().membersOpen).toBe(false)
  })

  it('voltar para a lista fecha a gaveta de membros', () => {
    useMobileNavStore.setState({ panel: 'content', membersOpen: true })
    useMobileNavStore.getState().showNav()
    expect(useMobileNavStore.getState().membersOpen).toBe(false)
  })

  it('navegar decide o painel e fecha a gaveta', () => {
    useMobileNavStore.setState({ panel: 'nav', membersOpen: true })
    useMobileNavStore.getState().navigated({ prev: '/', next: '/dm/u1', action: 'PUSH' })
    expect(useMobileNavStore.getState()).toMatchObject({ panel: 'content', membersOpen: false })
  })
})
