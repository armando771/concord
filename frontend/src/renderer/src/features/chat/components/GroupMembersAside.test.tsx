import { describe, expect, it, vi } from 'vitest'

vi.mock('./GroupMemberRow', () => ({
  default: ({ member }: { member: { display_name: string } }) => <li>{member.display_name}</li>
}))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ConversationSummary } from '../api/conversations'
import GroupMembersAside from './GroupMembersAside'

const conv = {
  id: 'g1',
  owner_id: 'me',
  members: [
    { id: 'me', username: 'me', display_name: 'Eu' },
    { id: 'a', username: 'a', display_name: 'Ana' }
  ]
} as unknown as ConversationSummary

const render = (): string =>
  renderToStaticMarkup(<GroupMembersAside conv={conv} meId="me" onRemove={() => {}} />)

describe('GroupMembersAside', () => {
  it('lista os membros com a contagem', () => {
    const html = render()
    expect(html).toContain('Membros — 2')
    expect(html).toContain('Ana')
  })

  it('em tela estreita sobrepõe o chat (não divide a largura); a partir de lg volta para o lado', () => {
    const html = render()
    expect(html).toMatch(/<aside class="(?:[^"]*\s)?absolute[\s"]/)
    expect(html).toContain('lg:static')
    expect(html).toContain('shadow-2xl')
  })
})
