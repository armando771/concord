import { describe, expect, it } from 'vitest'
import { resolveProfileTheme, sameTheme } from './profileTheme'
import { PROFILE_PRESETS } from './profilePresets'

describe('predefinições', () => {
  it('todas são temas válidos', () => {
    for (const p of PROFILE_PRESETS) {
      expect(sameTheme(resolveProfileTheme(p.theme), p.theme), p.id).toBe(true)
      expect(resolveProfileTheme(p.theme), p.id).toEqual(p.theme)
    }
  })
})

describe('predefinições novas', () => {
  it('cada efeito em canvas tem pelo menos uma predefinição', () => {
    const used = new Set(PROFILE_PRESETS.map((p) => p.theme.effect))
    for (const id of [
      'fire',
      'matrix',
      'glitch',
      'storm',
      'galaxy',
      'aurora',
      'hearts',
      'confetti',
      'synthwave',
      'rain'
    ]) {
      expect(used.has(id), id).toBe(true)
    }
  })
  it('Pride: fundo arco-íris do orgulho, borda arco-íris e confete', () => {
    const pride = PROFILE_PRESETS.find((p) => p.id === 'pride')
    expect(pride?.label).toBe('Pride')
    expect(pride?.theme).toMatchObject({
      background: 'pride',
      background_colors: [],
      border: 'rainbow',
      border_width: 3,
      effect: 'confetti'
    })
  })
  it('IDs e nomes únicos', () => {
    expect(new Set(PROFILE_PRESETS.map((p) => p.id)).size).toBe(PROFILE_PRESETS.length)
    expect(new Set(PROFILE_PRESETS.map((p) => p.label)).size).toBe(PROFILE_PRESETS.length)
  })
})
