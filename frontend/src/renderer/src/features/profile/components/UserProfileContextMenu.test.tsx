import { describe, expect, it, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('window', {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
})

vi.mock('../../../app/router', () => ({
  default: {
    navigate: vi.fn(),
    state: { location: { pathname: '/' } }
  }
}))

vi.mock('../../call/lib/noiseSuppression', () => ({
  openMicrophone: vi.fn()
}))
vi.mock('../../call/lib/rtc', () => ({}))

// No ambiente de teste em Node (sem DOM real), o renderToStaticMarkup do React chama
// getServerSnapshot do useSyncExternalStore, que no Zustand 5 retorna o estado inicial vazio.
// Forçamos o uso do snapshot atual (getSnapshot) para testar os componentes conectados aos stores.
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())

import { useProfileCardStore } from '../store/profileCardStore'
import { useUserMenuStore } from '../store/userMenuStore'
import UserContextMenu from './UserContextMenu'
import { useUserAudioStore } from '../../call/store/userAudioStore'

describe('UserProfileCard e UserContextMenu integração', () => {
  beforeEach(() => {
    useProfileCardStore.setState({ target: null })
    useUserMenuStore.setState({ target: null })
  })

  it('permite abrir o menu de contexto através do useUserMenuStore com anchorEl', () => {
    const dummyButton = {
      getBoundingClientRect: () => ({ left: 250, bottom: 400, top: 380, right: 280, width: 30, height: 20 })
    } as unknown as HTMLElement

    useUserMenuStore.getState().open({
      userId: 'user-mugis',
      name: 'Mugis',
      username: 'mugis',
      x: 250,
      y: 404,
      anchorEl: dummyButton
    })

    const target = useUserMenuStore.getState().target
    expect(target).not.toBeNull()
    expect(target?.userId).toBe('user-mugis')
    expect(target?.name).toBe('Mugis')
    expect(target?.anchorEl).toBe(dummyButton)
  })

  it('UserContextMenu renderiza com z-[80] e data-user-context-menu para sobrepor o perfil (z-[60])', () => {
    useUserAudioStore.getState().setVolume('user-mugis', 0.16)

    useUserMenuStore.getState().open({
      userId: 'user-mugis',
      name: 'Mugis',
      username: 'mugis',
      x: 250,
      y: 404
    })

    const html = renderToStaticMarkup(<UserContextMenu />)
    // Deve conter z-[80] para ficar acima do perfil que tem z-[60]
    expect(html).toContain('z-[80]')
    // Deve conter o identificador data-user-context-menu
    expect(html).toContain('data-user-context-menu="true"')
    // Deve ter limite de altura e scroll caso haja muitas opções
    expect(html).toContain('max-h-[calc(100vh-16px)]')
    expect(html).toContain('overflow-y-auto')
    // Deve conter opções de controle do usuário
    expect(html).toContain('Mugis')
    expect(html).not.toContain('Copiar ID')
  })

  it('UserContextMenu fecha corretamente ao chamar close()', () => {
    useUserMenuStore.getState().open({
      userId: 'user-mugis',
      name: 'Mugis',
      x: 200,
      y: 200
    })
    expect(useUserMenuStore.getState().target).not.toBeNull()

    useUserMenuStore.getState().close()
    expect(useUserMenuStore.getState().target).toBeNull()
  })

  it('permite alternar (toggle) quando o menu já está aberto para o mesmo usuário', () => {
    const openMenuOrToggle = (userId: string, name: string) => {
      const current = useUserMenuStore.getState().target
      if (current && current.userId === userId) {
        useUserMenuStore.getState().close()
        return
      }
      useUserMenuStore.getState().open({
        userId,
        name,
        x: 200,
        y: 300
      })
    }

    // Primeiro clique abre
    openMenuOrToggle('user-mugis', 'Mugis')
    expect(useUserMenuStore.getState().target?.userId).toBe('user-mugis')

    // Segundo clique fecha (toggle)
    openMenuOrToggle('user-mugis', 'Mugis')
    expect(useUserMenuStore.getState().target).toBeNull()
  })

  it('não fecha o perfil ao clicar dentro de elementos com [data-user-context-menu]', () => {
    // Simula a lógica de dismiss do UserProfileCard
    const shouldCloseProfile = (targetNode: { closest: (selector: string) => boolean | null }) => {
      const isInsideMenu = Boolean(targetNode.closest('[data-user-context-menu]'))
      return !isInsideMenu
    }

    const sliderElement = {
      closest: (sel: string) => (sel === '[data-user-context-menu]' ? true : null)
    }
    const outsideElement = {
      closest: () => null
    }

    expect(shouldCloseProfile(sliderElement)).toBe(false)
    expect(shouldCloseProfile(outsideElement)).toBe(true)
  })
})
