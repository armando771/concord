import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ perms: 0, viewing: 's1' }))
vi.mock('../../servers/hooks/useServerAccess', () => ({
  useServerAccess: () => ({ can: (want: number) => (state.perms & want) === want })
}))
vi.mock('../../servers/store/serverStore', () => ({
  useServerStore: (sel: (s: { currentServer: { id: string } }) => unknown) =>
    sel({ currentServer: { id: state.viewing } })
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string } }) => unknown) => sel({ user: { id: 'eu' } })
}))
vi.mock('../store/stickerStore', () => ({
  selectStickers: () => () => [],
  useStickerStore: (sel: (s: { deleteSticker: () => void }) => unknown) =>
    sel({ deleteSticker: vi.fn() })
}))

import { renderToStaticMarkup } from 'react-dom/server'
import StickersTab from './StickersTab'
import { Perm } from '../../servers/lib/permissions'

const render = (): string =>
  renderToStaticMarkup(
    <StickersTab serverId="s1" search="" onAdd={() => {}} onSelectSticker={() => {}} />
  )

describe('StickersTab', () => {
  it('com "Adicionar figurinhas" mostra o envio', () => {
    state.perms = Perm.ADD_STICKERS
    const html = render()
    expect(html).toContain('Nova Figurinha')
    expect(html).toContain('Adicionar a primeira')
  })

  it('sem "Adicionar figurinhas" esconde o envio', () => {
    state.perms = 0
    const html = render()
    expect(html).not.toContain('Nova Figurinha')
    expect(html).not.toContain('Adicionar a primeira')
    expect(html).toContain('Nenhuma figurinha no servidor ainda.')
  })

  it('em outro servidor (sem os cargos dele) deixa o servidor decidir', () => {
    state.perms = 0
    state.viewing = 'outro'
    expect(render()).toContain('Nova Figurinha')
    state.viewing = 's1'
  })
})
