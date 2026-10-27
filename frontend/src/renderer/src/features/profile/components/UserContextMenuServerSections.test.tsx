import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  RoleAssignMenuItems,
  UserVoiceMoveSection,
  StandardUserServerSection
} from './UserContextMenuServerSections'

describe('UserContextMenuServerSections', () => {
  it('RoleAssignMenuItems renderiza nulo quando givable é vazio', () => {
    const html = renderToStaticMarkup(
      <RoleAssignMenuItems
        givable={[]}
        saving={false}
        itemClass="item"
        onToggleRole={vi.fn()}
      />
    )
    expect(html).toBe('')
  })

  it('RoleAssignMenuItems renderiza opções de cargos', () => {
    const html = renderToStaticMarkup(
      <RoleAssignMenuItems
        givable={[{ id: 'r1', name: 'Moderador', color: 0xff0000, position: 2, permissions: 0, hoist: false, is_default: false, server_id: 's1' }]}
        memberRoleIds={['r1']}
        saving={false}
        itemClass="item"
        onToggleRole={vi.fn()}
      />
    )
    expect(html).toContain('Moderador')
    expect(html).toContain('✓')
  })

  it('UserVoiceMoveSection renderiza lista de canais', () => {
    const html = renderToStaticMarkup(
      <UserVoiceMoveSection
        moveTargets={[{ id: 'ch2', name: 'Canal 2' }]}
        saving={false}
        itemClass="item"
        onMoveTo={vi.fn()}
      />
    )
    expect(html).toContain('Canal 2')
  })

  it('StandardUserServerSection renderiza botão alterar apelido quando canNick é true', () => {
    const html = renderToStaticMarkup(
      <StandardUserServerSection
        server={{ id: 's1' }}
        member={{ user_id: 'u1', role_ids: [] }}
        canNick={true}
        givable={[]}
        canMuteInVoice={false}
        canDeafenInVoice={false}
        canDisconnect={false}
        canKick={false}
        canBan={false}
        target={{ userId: 'u1', name: 'Usuário 1' }}
        saving={false}
        close={vi.fn()}
        itemClass="item"
        onEditNickname={vi.fn()}
        onToggleRole={vi.fn()}
        onModerate={vi.fn()}
      />
    )
    expect(html).toContain('Alterar apelido')
  })
})
