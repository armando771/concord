import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ALL_PERMISSIONS,
  DEFAULT_EVERYONE,
  PERMISSION_GROUPS,
  Perm,
  canActOn,
  canGrant,
  canManageRole,
  channelPermissionGroups,
  computeBase,
  computeChannel,
  has,
  highestPosition,
  normalize,
  parseColorCss,
  permissionError,
  roleColorCss,
  rolesOfMember,
  type ChannelKind,
  type ChannelOverwrite,
  type Role
} from './permissions'

// Os mesmos casos rodam no backend (permission/vectors_test.go): os dois lados
// têm que calcular igual.
interface Vectors {
  bits: Record<string, number>
  defaults: { everyone: string[]; moderator: string[] }
  compute: {
    name: string
    owner_id: string
    user_id: string
    everyone: string[]
    roles: { id: string; position: number; permissions: string[] }[]
    member_roles: string[]
    channel: {
      type: ChannelKind
      overwrites: {
        target_type: 'role' | 'member'
        target_id: string
        allow: string[]
        deny: string[]
      }[]
    }
    expect_base: string[]
    expect_channel: string[]
  }[]
  can_act_on: {
    name: string
    owner_id: string
    actor: string
    target: string
    actor_highest: number
    target_highest: number
    expect: boolean
  }[]
  can_manage_role: {
    name: string
    is_owner: boolean
    actor_highest: number
    role_position: number
    expect: boolean
  }[]
  can_grant: { name: string; actor: string[]; changed: string[]; expect: boolean }[]
}

const vectors: Vectors = JSON.parse(
  readFileSync(
    new URL('../../../../../backend/internal/permission/testdata/vectors.json', import.meta.url),
    'utf8'
  )
)

const bits = (names: string[]): number =>
  names.reduce((sum, n) => {
    if (n === 'ALL') return sum | ALL_PERMISSIONS
    const bit = vectors.bits[n]
    if (bit === undefined) throw new Error(`permissão desconhecida ${n}`)
    return sum | bit
  }, 0)

describe('bits compartilhados com o backend', () => {
  it('têm os mesmos nomes e valores', () => {
    expect(Perm).toEqual(vectors.bits)
  })

  it('os padrões batem com os do servidor', () => {
    expect(DEFAULT_EVERYONE).toBe(bits(vectors.defaults.everyone))
  })

  it('cabem em 32 bits (bitwise do JS)', () => {
    expect(ALL_PERMISSIONS).toBeGreaterThan(0)
    expect(ALL_PERMISSIONS).toBeLessThan(2 ** 31)
  })

  it('normalize descarta bits desconhecidos', () => {
    expect(normalize(ALL_PERMISSIONS | (1 << 14) | (1 << 29))).toBe(ALL_PERMISSIONS)
  })
})

describe('computeBase / computeChannel (casos do backend)', () => {
  for (const tc of vectors.compute) {
    it(tc.name, () => {
      const everyone: Role = {
        id: 'everyone',
        server_id: 's',
        name: '@everyone',
        color: null,
        position: 0,
        permissions: bits(tc.everyone),
        hoist: false,
        is_default: true
      }
      const roles: Role[] = [
        everyone,
        ...tc.roles.map((r) => ({
          id: r.id,
          server_id: 's',
          name: r.id,
          color: null,
          position: r.position,
          permissions: bits(r.permissions),
          hoist: false,
          is_default: false
        }))
      ]
      const own = rolesOfMember(roles, tc.member_roles)
      const base = computeBase(tc.owner_id, tc.user_id, everyone.permissions, own)
      expect(base).toBe(bits(tc.expect_base))

      const overwrites: ChannelOverwrite[] = tc.channel.overwrites.map((o) => ({
        target_type: o.target_type,
        target_id: o.target_id,
        allow: bits(o.allow),
        deny: bits(o.deny)
      }))
      const channel = computeChannel(
        base,
        tc.channel.type,
        overwrites,
        everyone.id,
        tc.user_id,
        tc.member_roles
      )
      expect(channel).toBe(bits(tc.expect_channel))
    })
  }
})

describe('hierarquia (casos do backend)', () => {
  for (const tc of vectors.can_act_on) {
    it(`canActOn: ${tc.name}`, () => {
      expect(canActOn(tc.owner_id, tc.actor, tc.target, tc.actor_highest, tc.target_highest)).toBe(
        tc.expect
      )
    })
  }
  for (const tc of vectors.can_manage_role) {
    it(`canManageRole: ${tc.name}`, () => {
      expect(canManageRole(tc.is_owner, tc.actor_highest, tc.role_position)).toBe(tc.expect)
    })
  }
  for (const tc of vectors.can_grant) {
    it(`canGrant: ${tc.name}`, () => {
      expect(canGrant(bits(tc.actor), bits(tc.changed))).toBe(tc.expect)
    })
  }
})

describe('has', () => {
  it('exige todos os bits pedidos', () => {
    const perms = Perm.VIEW_CHANNEL | Perm.SEND_MESSAGES
    expect(has(perms, Perm.VIEW_CHANNEL)).toBe(true)
    expect(has(perms, Perm.VIEW_CHANNEL | Perm.SEND_MESSAGES)).toBe(true)
    expect(has(perms, Perm.VIEW_CHANNEL | Perm.MANAGE_ROLES)).toBe(false)
    expect(has(perms, 0)).toBe(true)
  })
})

describe('cargos do membro', () => {
  const role = (id: string, position: number, extra: Partial<Role> = {}): Role => ({
    id,
    server_id: 's',
    name: id,
    color: null,
    position,
    permissions: 0,
    hoist: false,
    is_default: false,
    ...extra
  })
  const roles = [
    role('everyone', 0, { is_default: true }),
    role('a', 1),
    role('b', 3),
    role('c', 2)
  ]

  it('vêm do mais alto para o mais baixo e sem o @everyone', () => {
    expect(rolesOfMember(roles, ['a', 'b', 'c', 'everyone']).map((r) => r.id)).toEqual([
      'b',
      'c',
      'a'
    ])
  })

  it('ignora ids que não existem e aceita lista ausente', () => {
    expect(rolesOfMember(roles, ['nada']).length).toBe(0)
    expect(rolesOfMember(roles, undefined).length).toBe(0)
  })

  it('highestPosition é 0 sem cargos', () => {
    expect(highestPosition([])).toBe(0)
    expect(highestPosition(rolesOfMember(roles, ['a', 'b']))).toBe(3)
  })
})

describe('textos', () => {
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

  it('traduz os códigos de erro do servidor', () => {
    expect(permissionError('missing_permission')).toMatch(/permissão/)
    expect(permissionError('role_hierarchy')).toMatch(/abaixo do seu cargo/)
    expect(permissionError('banned')).toMatch(/banido/)
    expect(permissionError('desconhecido', 'padrão')).toBe('padrão')
    expect(permissionError(undefined)).toBe('Algo deu errado')
  })
})

describe('cores', () => {
  it('converte entre número e CSS', () => {
    expect(roleColorCss(0xff00aa)).toBe('#ff00aa')
    expect(roleColorCss(0x0000ff)).toBe('#0000ff')
    expect(roleColorCss(null)).toBeUndefined()
    expect(parseColorCss('#ff00aa')).toBe(0xff00aa)
    expect(parseColorCss('FF00AA')).toBe(0xff00aa)
    expect(parseColorCss('#fff')).toBeNull()
    expect(parseColorCss('azul')).toBeNull()
  })
})
