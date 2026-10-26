import { describe, expect, it } from 'vitest'
import { PERMISSION_GROUPS, channelPermissionGroups } from './permissionGroups'
import { Perm } from './permissions'

describe('permissionGroups', () => {
  it('Administrador fica no primeiro grupo, em cima de Geral', () => {
    expect(PERMISSION_GROUPS[0].title).toBe('Administrador')
    expect(PERMISSION_GROUPS[0].permissions).toHaveLength(1)
    expect(PERMISSION_GROUPS[0].permissions[0].name).toBe('ADMINISTRATOR')
    expect(PERMISSION_GROUPS[1].title).toBe('Geral')
  })

  it('Canais de voz inclui DISCONNECT_MEMBERS', () => {
    const voice = PERMISSION_GROUPS.find((g) => g.title === 'Canais de voz')
    expect(voice).toBeDefined()
    const names = voice?.permissions.map((p) => p.name)
    expect(names).toContain('DISCONNECT_MEMBERS')
    expect(names).toContain('MOVE_MEMBERS')
  })

  it('channelPermissionGroups para texto e voz', () => {
    const textGroups = channelPermissionGroups('text')
    expect(textGroups.map((g) => g.title)).toEqual(['Geral', 'Canais de texto'])
    expect(textGroups[0].permissions.map((p) => p.name)).toEqual(['VIEW_CHANNEL'])

    const voiceGroups = channelPermissionGroups('voice')
    expect(voiceGroups.map((g) => g.title)).toEqual(['Geral', 'Canais de voz'])
    const voiceNames = voiceGroups[1].permissions.map((p) => p.name)
    expect(voiceNames).toContain('DISCONNECT_MEMBERS')
  })

  it('todas as permissões de PERMISSION_GROUPS existem no objeto Perm', () => {
    for (const group of PERMISSION_GROUPS) {
      for (const p of group.permissions) {
        expect(Perm[p.name]).toBeDefined()
      }
    }
  })
})
