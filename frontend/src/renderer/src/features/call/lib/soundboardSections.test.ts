import { describe, expect, it } from 'vitest'
import { findSoundForShortcut, soundboardSections } from './soundboardSections'

type Snd = { id: string; server_id: string; name: string }
const snd = (id: string, server = 'srv-a', name = id): Snd => ({ id, server_id: server, name })

describe('soundboardSections', () => {
  const server = [snd('a1', 'srv-a', 'Buzina'), snd('a2', 'srv-a', 'Corneta')]
  const favorites = [
    { ...snd('b1', 'srv-b', 'Bateria'), server_name: 'Servidor B' },
    { ...snd('a2', 'srv-a', 'Corneta'), server_name: 'Servidor A' }
  ]

  it('favoritos (de qualquer servidor) primeiro; o resto do servidor depois', () => {
    const { favorites: favs, server: rest } = soundboardSections(server, favorites, '')
    expect(favs.map((s) => s.id)).toEqual(['b1', 'a2'])
    expect(rest.map((s) => s.id)).toEqual(['a1'])
  })

  it('a busca filtra as duas seções pelo nome', () => {
    const { favorites: favs, server: rest } = soundboardSections(server, favorites, '  bAt ')
    expect(favs.map((s) => s.id)).toEqual(['b1'])
    expect(rest).toEqual([])
  })
})

describe('findSoundForShortcut', () => {
  it('acha o som do atalho entre os do servidor e os favoritos', () => {
    const keybinds = { b1: 'Alt+1', a1: 'F2' }
    const sounds = [snd('a1'), snd('b1', 'srv-b')]
    expect(findSoundForShortcut('alt+1', keybinds, sounds)?.id).toBe('b1')
    expect(findSoundForShortcut('F2', keybinds, sounds)?.id).toBe('a1')
    expect(findSoundForShortcut('F3', keybinds, sounds)).toBeUndefined()
  })
})
