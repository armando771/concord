import { describe, expect, it } from 'vitest'
import { Perm } from './permissions'
import { PERMISSION_GROUPS, channelPermissionGroups } from './permissionCatalog'

describe('catálogo de permissões', () => {
  it('toda permissão tem um grupo, um rótulo e uma descrição', () => {
    const listed = PERMISSION_GROUPS.flatMap((g) => g.permissions)
    expect(listed.map((p) => p.name).sort()).toEqual(Object.keys(Perm).sort())
    for (const p of listed) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.description.length).toBeGreaterThan(0)
    }
  })

  it('o editor de canal só mostra o que vale para o tipo', () => {
    const text = channelPermissionGroups('text').flatMap((g) => g.permissions.map((p) => p.name))
    const voice = channelPermissionGroups('voice').flatMap((g) => g.permissions.map((p) => p.name))
    expect(text).toContain('SEND_MESSAGES')
    expect(text).toContain('VIEW_CHANNEL')
    expect(text).not.toContain('SPEAK')
    expect(voice).toContain('SPEAK')
    expect(voice).toContain('CONNECT')
    expect(voice).not.toContain('SEND_MESSAGES')
  })
})
