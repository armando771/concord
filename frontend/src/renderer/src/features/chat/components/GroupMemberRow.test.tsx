import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ status: 'online' as string }))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: 'me' } })
}))
vi.mock('../store/chatStore', () => ({ usePresenceStatus: () => state.status }))
vi.mock('../../profile/store/profileStore', () => ({
  useUserLook: (_id: string, fallback: { name: string; avatarUrl?: string | null }) => ({
    name: fallback.name,
    avatarUrl: fallback.avatarUrl ?? null
  })
}))
vi.mock('../../profile/store/profileCardStore', () => ({ profileCardHandler: () => () => {} }))
vi.mock('../../profile/store/userMenuStore', () => ({ userMenuHandler: () => () => {} }))
vi.mock('../../profile/components/StyledName', () => ({
  default: ({ name }: { name: string }) => <b>{name}</b>
}))
vi.mock('../../../shared/ui/Avatar', () => ({ default: () => <u data-avatar /> }))

import { renderToStaticMarkup } from 'react-dom/server'
import GroupMemberRow from './GroupMemberRow'

const member = { id: 'u2', username: 'ana', display_name: 'Ana Souza' }

function render(over: Partial<React.ComponentProps<typeof GroupMemberRow>> = {}): string {
  return renderToStaticMarkup(
    <GroupMemberRow
      member={member}
      isOwner={false}
      canRemove={false}
      onRemove={() => {}}
      {...over}
    />
  )
}

describe('GroupMemberRow', () => {
  it('mostra avatar e nome do participante', () => {
    state.status = 'online'
    const html = render()
    expect(html).toContain('data-avatar')
    expect(html).toContain('Ana Souza')
    expect(html).toContain('text-gray-200')
  })

  it('offline fica mais apagado', () => {
    state.status = 'offline'
    expect(render()).toContain('text-gray-500')
  })

  it('o dono do grupo leva a coroa', () => {
    expect(render({ isOwner: true })).toContain('Dono do grupo')
    expect(render()).not.toContain('Dono do grupo')
  })

  it('só quem pode remover vê o botão, com rótulo para leitor de tela', () => {
    expect(render({ canRemove: true })).toContain('aria-label="Remover do grupo"')
    expect(render()).not.toContain('Remover do grupo')
  })

  it('o botão de remover não some do toque nem do teclado (antes era display:none até o hover)', () => {
    const button = /<button[^>]*aria-label="Remover do grupo"[^>]*>/.exec(render({ canRemove: true }))?.[0] ?? ''
    expect(button).not.toBe('')
    expect(button.split(/[\s"]+/)).not.toContain('hidden')
    expect(button).toContain('[@media(hover:hover)]:sr-only')
    expect(button).toContain('focus-visible:not-sr-only')
  })
})
