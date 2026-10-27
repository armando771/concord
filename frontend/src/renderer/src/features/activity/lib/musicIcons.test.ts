import { describe, expect, it } from 'vitest'
import { musicIconPath } from './musicIcons'

describe('musicIconPath', () => {
  it('logo dos players conhecidos; os outros ficam com a nota musical', () => {
    expect(musicIconPath('Spotify')).toMatch(/^M/)
    expect(musicIconPath('YouTube Music')).toMatch(/^M/)
    expect(musicIconPath('Deezer')).toBeUndefined()
    expect(musicIconPath('Chrome')).toBeUndefined()
  })
})
