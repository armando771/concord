import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  RoleSubmenuItems,
  UserMemberSubmenus,
  VoiceMoveSubmenuItems
} from './UserContextMenuSubmenus'
import type { Role } from '../../servers/lib/permissions'

const role = (over: Partial<Role>): Role => ({
  id: 'r1',
  name: 'Moderador',
  color: 0xff0000,
  position: 2,
  permissions: 0,
  hoist: false,
  is_default: false,
  server_id: 's1',
  ...over
})

const base = {
  givable: [role({})],
  memberRoleIds: ['r1'],
  moveTargets: [{ id: 'ch2', name: 'Canal 2' }],
  saving: false,
  itemClass: 'item',
  onToggleRole: vi.fn(),
  onMoveTo: vi.fn()
}

describe('UserMemberSubmenus', () => {
  it('mostra "Cargos" e "Mover para" como itens compactos, nessa ordem', () => {
    const html = renderToStaticMarkup(<UserMemberSubmenus {...base} />)
    expect(html.indexOf('Cargos')).toBeGreaterThan(-1)
    expect(html.indexOf('Mover para')).toBeGreaterThan(html.indexOf('Cargos'))
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('não lista cargos nem canais enquanto os submenus estão fechados', () => {
    const html = renderToStaticMarkup(<UserMemberSubmenus {...base} />)
    expect(html).not.toContain('Moderador')
    expect(html).not.toContain('Canal 2')
  })

  it('sem cargos atribuíveis mostra só "Mover para"', () => {
    const html = renderToStaticMarkup(<UserMemberSubmenus {...base} givable={[]} />)
    expect(html).not.toContain('Cargos')
    expect(html).toContain('Mover para')
  })

  it('sem canais para mover mostra só "Cargos"', () => {
    const html = renderToStaticMarkup(<UserMemberSubmenus {...base} moveTargets={[]} />)
    expect(html).toContain('Cargos')
    expect(html).not.toContain('Mover para')
  })

  it('sem nada para mostrar não renderiza nem o separador', () => {
    const html = renderToStaticMarkup(
      <UserMemberSubmenus {...base} givable={[]} moveTargets={[]} />
    )
    expect(html).toBe('')
  })
})

describe('RoleSubmenuItems', () => {
  it('lista cargo com bolinha de cor, nome e caixa marcada quando a pessoa tem o cargo', () => {
    const html = renderToStaticMarkup(
      <RoleSubmenuItems {...base} givable={[role({}), role({ id: 'r2', name: 'VIP' })]} />
    )
    expect(html).toContain('Moderador')
    expect(html).toContain('VIP')
    expect(html).toContain('role="menuitemcheckbox"')
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html.match(/aria-checked="false"/g)).toHaveLength(1)
    expect(html).toContain('✓')
  })

  it('marca aria-disabled enquanto salva, sem desabilitar o botão (o foco fica)', () => {
    const html = renderToStaticMarkup(<RoleSubmenuItems {...base} saving />)
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain(' disabled=""')
  })
})

describe('VoiceMoveSubmenuItems', () => {
  it('lista os canais de voz com ícone de alto-falante', () => {
    const html = renderToStaticMarkup(<VoiceMoveSubmenuItems {...base} />)
    expect(html).toContain('Canal 2')
    expect(html).toContain('<svg')
    expect(html).toContain('role="menuitem"')
  })
})
